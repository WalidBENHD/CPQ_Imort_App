using System.Security.Claims;
using System.Text.RegularExpressions;
using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Security;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Core.Security;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/access")]
[Authorize]
public class AccessController(AppDbContext db, IActivityService activityService, INotificationService notificationService) : ControllerBase
{
    [HttpGet("capabilities")]
    [Authorize(Policy = Capabilities.RolesManage)]
    public ActionResult<IReadOnlyList<string>> CapabilitiesCatalog() => Ok(Capabilities.All.OrderBy(value => value));

    [HttpGet("roles")]
    [Authorize]
    public async Task<ActionResult<IReadOnlyList<AccessRoleDto>>> Roles(CancellationToken ct)
    {
        var roles = await db.AccessRoles.AsNoTracking()
            .Include(role => role.RoleCapabilities)
            .Include(role => role.UserRoles)
            .OrderByDescending(role => role.IsSystem)
            .ThenBy(role => role.Name)
            .ToListAsync(ct);
        return Ok(roles.Select(ToDto));
    }

    [HttpPost("roles")]
    [Authorize(Policy = Capabilities.RolesManage)]
    public async Task<ActionResult<AccessRoleDto>> CreateRole([FromBody] SaveAccessRoleRequest request, CancellationToken ct)
    {
        var error = ValidateRole(request);
        if (error is not null) return BadRequest(new { error });

        var keyBase = Regex.Replace(request.Name.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(keyBase)) keyBase = "custom-role";
        var key = keyBase;
        var suffix = 2;
        while (await db.AccessRoles.AnyAsync(role => role.Key == key, ct)) key = $"{keyBase}-{suffix++}";

        var role = new AccessRole
        {
            Key = key,
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Icon = Normalize(request.Icon, "shield"),
            Color = Normalize(request.Color, "#2563eb"),
            RoleCapabilities = request.Capabilities.Distinct().Select(capability => new RoleCapability { Capability = capability }).ToList()
        };
        db.AccessRoles.Add(role);
        await db.SaveChangesAsync(ct);
        await LogAsync("CreateAccessRole", $"Created access role {role.Name}.", role, ct);
        return CreatedAtAction(nameof(Roles), ToDto(role));
    }

    [HttpPut("roles/{id:guid}")]
    [Authorize(Policy = Capabilities.RolesManage)]
    public async Task<ActionResult<AccessRoleDto>> UpdateRole(Guid id, [FromBody] SaveAccessRoleRequest request, CancellationToken ct)
    {
        var error = ValidateRole(request);
        if (error is not null) return BadRequest(new { error });

        var role = await db.AccessRoles.Include(value => value.RoleCapabilities).Include(value => value.UserRoles).FirstOrDefaultAsync(value => value.Id == id, ct);
        if (role is null) return NotFound(new { error = "Role not found." });
        if (role.Key == "system-administrator" && !Capabilities.All.SetEquals(request.Capabilities))
            return Conflict(new { error = "The System Administrator role must retain every capability to prevent administrative lockout." });

        var previousCapabilities = role.RoleCapabilities.Select(item => item.Capability).ToHashSet(StringComparer.Ordinal);
        var affectedUserIds = role.UserRoles.Select(userRole => userRole.UserId).ToList();
        role.Name = request.Name.Trim();
        role.Description = request.Description.Trim();
        role.Icon = Normalize(request.Icon, "shield");
        role.Color = Normalize(request.Color, "#2563eb");
        role.UpdatedAt = DateTime.UtcNow;
        var desired = request.Capabilities.Distinct().ToHashSet(StringComparer.Ordinal);
        foreach (var obsolete in role.RoleCapabilities.Where(item => !desired.Contains(item.Capability)).ToList())
        {
            db.RoleCapabilities.Remove(obsolete);
            role.RoleCapabilities.Remove(obsolete);
        }
        foreach (var capability in desired.Where(capability => role.RoleCapabilities.All(item => item.Capability != capability)))
            role.RoleCapabilities.Add(new RoleCapability { RoleId = role.Id, Capability = capability });
        await db.SaveChangesAsync(ct);
        if (!previousCapabilities.SetEquals(desired))
            await notificationService.NotifyRoleCapabilitiesChangedAsync(affectedUserIds, role.Name, CurrentActorName);
        await LogAsync("UpdateAccessRole", $"Updated access role {role.Name}.", role, ct);
        return Ok(ToDto(role));
    }

    [HttpDelete("roles/{id:guid}")]
    [Authorize(Policy = Capabilities.RolesManage)]
    public async Task<IActionResult> DeleteRole(Guid id, CancellationToken ct)
    {
        var role = await db.AccessRoles.Include(value => value.UserRoles).FirstOrDefaultAsync(value => value.Id == id, ct);
        if (role is null) return NotFound(new { error = "Role not found." });
        if (role.IsSystem) return Conflict(new { error = "Seeded roles cannot be deleted. Duplicate the role if you need a custom profile." });
        var affectedUserIds = role.UserRoles.Select(userRole => userRole.UserId).ToList();
        var roleName = role.Name;
        db.AccessRoles.Remove(role);
        await db.SaveChangesAsync(ct);
        foreach (var userId in affectedUserIds)
            await notificationService.NotifyUserAccessChangedAsync(userId, [], [roleName], CurrentActorName);
        await LogAsync("DeleteAccessRole", $"Deleted access role {role.Name}.", role, ct);
        return NoContent();
    }

    [HttpPut("users/{id:guid}")]
    [Authorize(Policy = Capabilities.UsersManage)]
    [Authorize(Policy = Capabilities.UsersAssignRoles)]
    public async Task<ActionResult<AuthUserDto>> UpdateUserAccess(Guid id, [FromBody] UpdateUserAccessRequest request, CancellationToken ct)
    {
        var user = await db.TestUsers.Include(value => value.AccessRoles).FirstOrDefaultAsync(value => value.Id == id, ct);
        if (user is null) return NotFound(new { error = "User not found." });
        var validRoleIds = await ValidateRoleIdsAsync(request.RoleIds, ct);
        if (validRoleIds is null) return BadRequest(new { error = "One or more selected roles do not exist." });

        var currentIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (Guid.TryParse(currentIdValue, out var currentId) && currentId == id && (!request.IsApproved || request.IsSuspended))
            return Conflict(new { error = "You cannot suspend or deactivate your own account." });

        var previousRoleNames = await db.UserAccessRoles.AsNoTracking()
            .Where(userRole => userRole.UserId == id)
            .Select(userRole => userRole.Role.Name)
            .OrderBy(name => name)
            .ToListAsync(ct);
        var nextRoleNames = await db.AccessRoles.AsNoTracking()
            .Where(role => validRoleIds.Contains(role.Id))
            .Select(role => role.Name)
            .OrderBy(name => name)
            .ToListAsync(ct);

        user.IsApproved = request.IsApproved;
        user.IsSuspended = request.IsSuspended;
        if (request.IsApproved && user.ApprovedAt is null)
        {
            user.ApprovedAt = DateTime.UtcNow;
            user.ApprovedByUserName = User.Identity?.Name ?? "administrator";
        }
        db.UserAccessRoles.RemoveRange(user.AccessRoles);
        user.AccessRoles = validRoleIds.Select(roleId => new UserAccessRole { UserId = user.Id, RoleId = roleId }).ToList();
        await db.SaveChangesAsync(ct);
        var changedBy = CurrentActorName;
        await notificationService.NotifyUserAccessChangedAsync(
            user.Id,
            nextRoleNames.Except(previousRoleNames, StringComparer.OrdinalIgnoreCase).ToList(),
            previousRoleNames.Except(nextRoleNames, StringComparer.OrdinalIgnoreCase).ToList(),
            changedBy);
        await activityService.LogAsync(new ActivityWriteRequest(ActivityCategory.Admin, "UpdateUserAccess", $"Updated account and role assignments for {user.DisplayName}.", TargetType: "User", TargetId: user.Id.ToString(), StatusCode: StatusCodes.Status200OK, Metadata: new { request.IsApproved, request.IsSuspended, RoleIds = validRoleIds }), ct);
        return Ok(await BuildUserDtoAsync(user, ct));
    }

    private string? ValidateRole(SaveAccessRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Role name is required.";
        var unknown = request.Capabilities.Except(Capabilities.All).ToList();
        return unknown.Count == 0 ? null : $"Unknown capabilities: {string.Join(", ", unknown)}";
    }

    private async Task<List<Guid>?> ValidateRoleIdsAsync(IReadOnlyList<Guid> requested, CancellationToken ct)
    {
        var distinct = requested.Distinct().ToList();
        var found = await db.AccessRoles.Where(role => distinct.Contains(role.Id)).Select(role => role.Id).ToListAsync(ct);
        return found.Count == distinct.Count ? found : null;
    }

    private async Task<AuthUserDto> BuildUserDtoAsync(TestUser user, CancellationToken ct)
    {
        var assignments = await db.UserAccessRoles.AsNoTracking().Where(value => value.UserId == user.Id)
            .Select(value => new { value.RoleId, value.Role.Name, Capabilities = value.Role.RoleCapabilities.Select(capability => capability.Capability) }).ToListAsync(ct);
        return new AuthUserDto(user.Id, user.UserName, user.DisplayName, user.Role, user.IsApproved, user.IsAdmin, user.CreatedAt, user.ApprovedAt, user.ApprovedByUserName, user.LastLoginAt, user.LastLoginAt, user.IsSuspended, assignments.Select(value => value.RoleId).ToList(), assignments.Select(value => value.Name).ToList(), assignments.SelectMany(value => value.Capabilities).Distinct().OrderBy(value => value).ToList());
    }

    private static AccessRoleDto ToDto(AccessRole role) => new(role.Id, role.Key, role.Name, role.Description, role.Icon, role.Color, role.IsSystem, role.RoleCapabilities.Select(value => value.Capability).OrderBy(value => value).ToList(), role.UserRoles.Count);
    private static string Normalize(string? value, string fallback) => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    private string CurrentActorName => User.FindFirstValue("name") ?? User.Identity?.Name ?? "an administrator";
    private Task LogAsync(string action, string description, AccessRole role, CancellationToken ct) => activityService.LogAsync(new ActivityWriteRequest(ActivityCategory.Admin, action, description, TargetType: "AccessRole", TargetId: role.Id.ToString(), StatusCode: StatusCodes.Status200OK, Metadata: new { role.Key, role.Name }), ct);
}
