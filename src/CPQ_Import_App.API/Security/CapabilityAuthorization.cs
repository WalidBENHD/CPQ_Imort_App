using System.Security.Claims;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Core.Security;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.API.Security;

public sealed record CapabilityRequirement(string Capability) : IAuthorizationRequirement;
public sealed record ActiveAccountRequirement : IAuthorizationRequirement;

public sealed class CapabilityAuthorizationHandler(AppDbContext db) : IAuthorizationHandler
{
    public async Task HandleAsync(AuthorizationHandlerContext context)
    {
        var userIdValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.User.FindFirstValue("sub");
        foreach (var requirement in context.PendingRequirements.ToList())
        {
            if (requirement is ActiveAccountRequirement activeRequirement)
            {
                if (!Guid.TryParse(userIdValue, out var activeUserId)
                    || await db.TestUsers.AsNoTracking().AnyAsync(user => user.Id == activeUserId && user.IsApproved && !user.IsSuspended))
                    context.Succeed(activeRequirement);
                continue;
            }

            if (requirement is not CapabilityRequirement capabilityRequirement) continue;
            if (Guid.TryParse(userIdValue, out var userId))
            {
                var allowed = await db.TestUsers.AsNoTracking()
                    .Where(user => user.Id == userId && user.IsApproved && !user.IsSuspended)
                    .SelectMany(user => user.AccessRoles)
                    .SelectMany(userRole => userRole.Role.RoleCapabilities)
                    .AnyAsync(roleCapability => roleCapability.Capability == capabilityRequirement.Capability);
                if (allowed) context.Succeed(capabilityRequirement);
                continue;
            }

            if (context.User.HasClaim("capabilities", capabilityRequirement.Capability)
                || HasCompatibleExternalRole(context.User, capabilityRequirement.Capability))
                context.Succeed(capabilityRequirement);
        }
    }

    private static bool HasCompatibleExternalRole(ClaimsPrincipal user, string capability)
    {
        var roles = user.Claims
            .Where(claim => claim.Type is "roles" or "role" or ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (roles.Contains("cpq-admin")) return true;
        if (capability == Capabilities.ToolsEvolis && roles.Contains("cpq-internal-tools")) return true;
        if (capability is Capabilities.ImportsApprove or Capabilities.ImportsReject or Capabilities.ImportsReturnToReview or Capabilities.ImportsPublish)
            return roles.Contains("cpq-approver") || roles.Contains("cpq-internal-tools");

        return false;
    }
}

public static class CapabilityPolicy
{
    public static AuthorizationPolicyBuilder RequireCapability(this AuthorizationPolicyBuilder policy, string capability)
        => policy.AddRequirements(new CapabilityRequirement(capability));
}

public sealed class AccessControlService(AppDbContext db)
{
    public async Task<IReadOnlyList<string>> GetCapabilitiesAsync(Guid userId, CancellationToken ct = default)
        => await db.UserAccessRoles
            .AsNoTracking()
            .Where(userRole => userRole.UserId == userId && userRole.User.IsApproved && !userRole.User.IsSuspended)
            .SelectMany(userRole => userRole.Role.RoleCapabilities)
            .Select(roleCapability => roleCapability.Capability)
            .Distinct()
            .OrderBy(capability => capability)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<string>> GetRoleKeysAsync(Guid userId, CancellationToken ct = default)
        => await db.UserAccessRoles
            .AsNoTracking()
            .Where(userRole => userRole.UserId == userId)
            .Select(userRole => userRole.Role.Key)
            .OrderBy(key => key)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Guid>> GetUserIdsWithCapabilityAsync(string capability, CancellationToken ct = default)
        => await db.UserAccessRoles
            .AsNoTracking()
            .Where(userRole => userRole.User.IsApproved && !userRole.User.IsSuspended
                && userRole.Role.RoleCapabilities.Any(roleCapability => roleCapability.Capability == capability))
            .Select(userRole => userRole.UserId)
            .Distinct()
            .ToListAsync(ct);
}

public static class AccessControlBootstrapper
{
    private sealed record SeedRole(Guid Id, string Key, string Name, string Description, string Icon, string Color, string[] Capabilities);

    private static readonly SeedRole[] Seeds =
    [
        new(Guid.Parse("a1000000-0000-0000-0000-000000000001"), "data-contributor", "Data Contributor", "Prepares, corrects and submits governed data.", "upload_file", "#0f766e", [Capabilities.ImportsView, Capabilities.ImportsUpload, Capabilities.ImportsCorrectOwn, Capabilities.ImportsWithdrawOwn, Capabilities.ImportsSubmit]),
        new(Guid.Parse("a1000000-0000-0000-0000-000000000002"), "data-approver", "Data Approver", "Reviews business impact and signs off publication.", "verified_user", "#2563eb", [Capabilities.ImportsView, Capabilities.ImportsApprove, Capabilities.ImportsReject, Capabilities.ImportsReturnToReview, Capabilities.AuditView]),
        new(Guid.Parse("a1000000-0000-0000-0000-000000000003"), "cpq-publisher", "CPQ Publisher", "Controls the final write into CPQ.", "rocket_launch", "#7c3aed", [Capabilities.ImportsView, Capabilities.ImportsPublish, Capabilities.AuditView]),
        new(Guid.Parse("a1000000-0000-0000-0000-000000000004"), "internal-tools-user", "Internal Tools User", "Uses protected operational utilities.", "lock_open", "#c2410c", [Capabilities.ToolsEvolis]),
        new(Guid.Parse("a1000000-0000-0000-0000-000000000005"), "auditor", "Auditor", "Read-only access to submissions and governance evidence.", "fact_check", "#475569", [Capabilities.ImportsView, Capabilities.AuditView]),
        new(Guid.Parse("a1000000-0000-0000-0000-000000000006"), "system-administrator", "System Administrator", "Manages users, access rules and maintenance.", "admin_panel_settings", "#be123c", Capabilities.All.OrderBy(value => value).ToArray())
    ];

    public static async Task EnsureSeedDataAsync(AppDbContext db, CancellationToken ct = default)
    {
        foreach (var seed in Seeds)
        {
            var role = await db.AccessRoles.Include(value => value.RoleCapabilities).FirstOrDefaultAsync(value => value.Key == seed.Key, ct);
            if (role is null)
            {
                role = new AccessRole { Id = seed.Id, Key = seed.Key, Name = seed.Name, Description = seed.Description, Icon = seed.Icon, Color = seed.Color, IsSystem = true };
                role.RoleCapabilities = seed.Capabilities.Select(capability => new RoleCapability { Capability = capability }).ToList();
                db.AccessRoles.Add(role);
            }
            else
            {
                role.Name = seed.Name;
                role.Description = seed.Description;
                role.Icon = seed.Icon;
                role.Color = seed.Color;
                role.IsSystem = true;
                role.UpdatedAt = DateTime.UtcNow;
            }

            if (seed.Key == "system-administrator")
            {
                foreach (var capability in Capabilities.All.Where(capability => role.RoleCapabilities.All(item => item.Capability != capability)))
                    role.RoleCapabilities.Add(new RoleCapability { Role = role, Capability = capability });
            }
        }

        await db.SaveChangesAsync(ct);

        var roleIds = await db.AccessRoles.Where(role => role.IsSystem).ToDictionaryAsync(role => role.Key, role => role.Id, ct);
        var users = await db.TestUsers.Include(user => user.AccessRoles).ToListAsync(ct);
        foreach (var user in users.Where(user => user.IsApproved && user.AccessRoles.Count == 0))
        {
            var keys = LegacyRoleKeys(user);
            foreach (var key in keys)
                user.AccessRoles.Add(new UserAccessRole { UserId = user.Id, RoleId = roleIds[key] });
        }

        await db.SaveChangesAsync(ct);
    }

    private static IReadOnlyList<string> LegacyRoleKeys(TestUser user)
    {
        if (user.IsAdmin) return ["system-administrator"];
        if (string.Equals(user.Role, "cpq-approver", StringComparison.OrdinalIgnoreCase)) return ["data-approver", "cpq-publisher"];
        if (string.Equals(user.Role, "cpq-internal-tools", StringComparison.OrdinalIgnoreCase)) return ["data-approver", "cpq-publisher", "internal-tools-user"];
        return ["data-contributor"];
    }
}
