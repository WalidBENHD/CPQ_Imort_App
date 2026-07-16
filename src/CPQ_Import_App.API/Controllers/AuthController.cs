using System.Security.Claims;
using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Monitoring;
using CPQ_Import_App.API.Security;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Infrastructure.Services;
using CPQ_Import_App.Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    AppDbContext db,
    LocalJwtTokenFactory tokenFactory,
    INotificationService notificationService,
    IActivityService activityService,
    ILiveUserPresenceTracker liveUserPresenceTracker,
    AccessControlService accessControlService) : ControllerBase
{
    private string CurrentUserName => User.FindFirstValue("preferred_username")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? "unknown";

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrWhiteSpace(request.Password))
        {
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Authentication,
                "RegisterFailed",
                "Registration failed: missing username or password.",
                Metadata: new { request.UserName }),
                ct);
            return BadRequest(new { error = "Username and password are required." });
        }

        if (request.Password.Length < 8)
        {
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Authentication,
                "RegisterFailed",
                "Registration failed: password too short.",
                Metadata: new { request.UserName }),
                ct);
            return BadRequest(new { error = "Password must be at least 8 characters long." });
        }

        var normalized = request.UserName.Trim().ToUpperInvariant();
        var exists = await db.TestUsers.AnyAsync(x => x.NormalizedUserName == normalized, ct);
        if (exists)
        {
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Authentication,
                "RegisterFailed",
                "Registration failed: username already exists.",
                Metadata: new { request.UserName }),
                ct);
            return Conflict(new { error = "Username already exists." });
        }

        var (hash, salt) = PasswordHasher.HashPassword(request.Password);
        var displayName = string.IsNullOrWhiteSpace(request.DisplayName)
            ? request.UserName.Trim()
            : request.DisplayName.Trim();

        db.TestUsers.Add(new TestUser
        {
            UserName = request.UserName.Trim(),
            NormalizedUserName = normalized,
            DisplayName = displayName,
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = "cpq-user",
            IsApproved = false,
            IsAdmin = false
        });

        await db.SaveChangesAsync(ct);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Authentication,
            "Register",
            $"New user registered: {displayName}.",
            TargetType: "User",
            TargetId: normalized,
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { request.UserName, displayName }),
            ct);

        // Notify all admins about the new pending user
        var newUser = await db.TestUsers.FirstOrDefaultAsync(x => x.NormalizedUserName == normalized, ct);
        if (newUser != null)
        {
            var adminIds = await accessControlService.GetUserIdsWithCapabilityAsync(CPQ_Import_App.Core.Security.Capabilities.UsersManage, ct);

            if (adminIds.Any())
            {
                await notificationService.NotifyAdminsAboutPendingUserAsync(newUser, adminIds.ToList());
            }
        }

        return Ok(new
        {
            message = "Account created. An admin must approve your account before you can sign in."
        });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthTokenResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrWhiteSpace(request.Password))
        {
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Authentication,
                "LoginFailed",
                "Login failed: missing username or password.",
                Metadata: new { request.UserName }),
                ct);
            return BadRequest(new { error = "Username and password are required." });
        }

        var normalized = request.UserName.Trim().ToUpperInvariant();
        var user = await db.TestUsers.FirstOrDefaultAsync(x => x.NormalizedUserName == normalized, ct);
        if (user is null || !PasswordHasher.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt))
        {
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Authentication,
                "LoginFailed",
                "Login failed: invalid credentials.",
                Metadata: new { request.UserName }),
                ct);
            return Unauthorized(new { error = "Invalid username or password." });
        }

        if (!user.IsApproved)
        {
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Authentication,
                "LoginFailed",
                "Login failed: account pending approval.",
                TargetType: "User",
                TargetId: user.Id.ToString(),
                ExplicitUserId: user.Id.ToString(),
                ExplicitUserName: user.DisplayName,
                Metadata: new { user.UserName }),
                ct);
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "Your account is pending admin approval."
            });
        }

        if (user.IsSuspended)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Your account has been suspended. Contact an administrator." });
        }

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Authentication,
            "Login",
            "User signed in.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            ExplicitUserId: user.Id.ToString(),
            ExplicitUserName: user.DisplayName,
            ExplicitUserRole: user.Role),
            ct);

        var roles = await accessControlService.GetRoleKeysAsync(user.Id, ct);
        var capabilities = await accessControlService.GetCapabilitiesAsync(user.Id, ct);
        var (token, expiresAtUtc) = tokenFactory.CreateToken(user, roles, capabilities);
        return Ok(new AuthTokenResponse(token, expiresAtUtc, await ToDtoAsync(user, ct)));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthUserDto>> Me(CancellationToken ct)
    {
        var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idValue, out var userId))
        {
            return Unauthorized();
        }

        var user = await db.TestUsers.FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (user is null)
        {
            return Unauthorized();
        }

        if (!user.IsApproved || user.IsSuspended) return Unauthorized();
        return Ok(await ToDtoAsync(user, ct));
    }

    [HttpGet("pending")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IReadOnlyList<AuthUserDto>>> Pending(CancellationToken ct)
    {
        var users = await db.TestUsers
            .AsNoTracking()
            .Where(x => !x.IsApproved)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(ct);

        var result = new List<AuthUserDto>();
        foreach (var user in users) result.Add(await ToDtoAsync(user, ct));
        return Ok(result);
    }

    [HttpGet("users")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<IReadOnlyList<AuthUserDto>>> Users(CancellationToken ct)
    {
        var users = await db.TestUsers
            .AsNoTracking()
            .OrderBy(x => x.UserName)
            .ToListAsync(ct);

        var userIds = users.Select(x => x.Id.ToString()).ToList();
        var activityByUserId = await db.ActivityEvents
            .AsNoTracking()
            .Where(x => x.UserId != null && userIds.Contains(x.UserId))
            .GroupBy(x => x.UserId!)
            .Select(g => new { UserId = g.Key, LastSeenAt = g.Max(x => x.OccurredAtUtc) })
            .ToDictionaryAsync(x => x.UserId, x => (DateTime?)x.LastSeenAt, ct);

        var result = new List<AuthUserDto>();
        foreach (var user in users)
        {
            activityByUserId.TryGetValue(user.Id.ToString(), out var lastSeenAt);

            var liveLastSeenAt = liveUserPresenceTracker.GetLastSeenUtc(user.Id.ToString());
            if (liveLastSeenAt.HasValue && (!lastSeenAt.HasValue || liveLastSeenAt > lastSeenAt))
            {
                lastSeenAt = liveLastSeenAt;
            }

            result.Add(await ToDtoAsync(user, ct, lastSeenAt));
        }
        return Ok(result);
    }

    [HttpPost("users")]
    [Authorize(Policy = "AdminOnly")]
    [Authorize(Policy = "users.assign_roles")]
    public async Task<ActionResult<AuthUserDto>> CreateUser([FromBody] AdminCreateUserRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Username and password are required." });
        }

        if (request.Password.Length < 8)
        {
            return BadRequest(new { error = "Password must be at least 8 characters long." });
        }

        var normalized = request.UserName.Trim().ToUpperInvariant();
        var exists = await db.TestUsers.AnyAsync(x => x.NormalizedUserName == normalized, ct);
        if (exists)
        {
            return Conflict(new { error = "Username already exists." });
        }

        var requestedRoleIds = request.RoleIds?.Distinct().ToList() ?? [];
        var validRoleIds = await db.AccessRoles.Where(role => requestedRoleIds.Contains(role.Id)).Select(role => role.Id).ToListAsync(ct);
        if (validRoleIds.Count != requestedRoleIds.Count)
        {
            return BadRequest(new { error = "One or more selected roles do not exist." });
        }

        var (hash, salt) = PasswordHasher.HashPassword(request.Password);
        var user = new TestUser
        {
            UserName = request.UserName.Trim(),
            NormalizedUserName = normalized,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? request.UserName.Trim() : request.DisplayName.Trim(),
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = "capability-managed",
            IsAdmin = false,
            IsApproved = request.IsApproved,
            ApprovedAt = request.IsApproved ? DateTime.UtcNow : null,
            ApprovedByUserName = request.IsApproved ? CurrentUserName : null
        };

        db.TestUsers.Add(user);
        await db.SaveChangesAsync(ct);

        if (validRoleIds.Count > 0)
        {
            db.UserAccessRoles.AddRange(validRoleIds.Select(roleId => new UserAccessRole { UserId = user.Id, RoleId = roleId }));
            await db.SaveChangesAsync(ct);
        }

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "AdminCreateUser",
            $"Admin created user {user.DisplayName}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { user.UserName, user.IsApproved, request.RoleIds }),
            ct);
        return Ok(await ToDtoAsync(user, ct));
    }

    [HttpPost("users/{id:guid}/approve")]
    [Authorize(Policy = "AdminOnly")]
    [Authorize(Policy = "users.assign_roles")]
    public async Task<ActionResult<AuthUserDto>> Approve(Guid id, [FromBody] ApproveUserRequest request, CancellationToken ct)
    {
        var user = await db.TestUsers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null)
        {
            return NotFound(new { error = "User not found." });
        }

        var requestedRoleIds = request.RoleIds?.Distinct().ToList() ?? [];
        var validRoleIds = await db.AccessRoles.Where(role => requestedRoleIds.Contains(role.Id)).Select(role => role.Id).ToListAsync(ct);
        if (validRoleIds.Count != requestedRoleIds.Count)
        {
            return BadRequest(new { error = "One or more selected roles do not exist." });
        }

        user.IsApproved = true;
        user.Role = "capability-managed";
        user.IsAdmin = false;
        user.IsSuspended = false;
        user.ApprovedAt = DateTime.UtcNow;
        user.ApprovedByUserName = CurrentUserName;

        await db.SaveChangesAsync(ct);
        if (validRoleIds.Count > 0)
        {
            db.UserAccessRoles.AddRange(validRoleIds.Select(roleId => new UserAccessRole { UserId = user.Id, RoleId = roleId }));
            await db.SaveChangesAsync(ct);
        }
        
        // Notify user that they were approved
        await notificationService.NotifyUserApprovedAsync(user.Id, CurrentUserName);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "ApproveUser",
            $"Admin approved user {user.DisplayName}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { user.UserName, request.RoleIds }),
            ct);
        
        return Ok(await ToDtoAsync(user, ct));
    }

    [HttpPost("users/{id:guid}/reject")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> RejectUser(Guid id, CancellationToken ct)
    {
        var user = await db.TestUsers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null)
        {
            return NotFound(new { error = "User not found." });
        }

        if (user.IsApproved)
        {
            return Conflict(new { error = "Cannot reject an already approved user. Use delete if you want to remove them." });
        }

        db.TestUsers.Remove(user);
        await db.SaveChangesAsync(ct);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "RejectUser",
            $"Admin rejected user {user.DisplayName}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status204NoContent,
            Metadata: new { user.UserName }),
            ct);
        return NoContent();
    }

    [HttpPost("users/{id:guid}/role")]
    [Authorize(Policy = "AdminOnly")]
    [Authorize(Policy = "users.assign_roles")]
    public async Task<ActionResult<AuthUserDto>> UpdateRole(Guid id, [FromBody] UpdateUserRoleRequest request, CancellationToken ct)
    {
        var user = await db.TestUsers.Include(x => x.AccessRoles).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null)
        {
            return NotFound(new { error = "User not found." });
        }

        if (!user.IsApproved)
        {
            return Conflict(new { error = "User must be approved first." });
        }

        var roleIds = await db.AccessRoles.Where(role => request.RoleIds.Contains(role.Id)).Select(role => role.Id).ToListAsync(ct);
        if (roleIds.Count != request.RoleIds.Distinct().Count()) return BadRequest(new { error = "One or more selected roles do not exist." });
        var oldRole = string.Join(", ", await accessControlService.GetRoleKeysAsync(user.Id, ct));
        db.UserAccessRoles.RemoveRange(user.AccessRoles);
        user.AccessRoles = roleIds.Select(roleId => new UserAccessRole { UserId = user.Id, RoleId = roleId }).ToList();
        user.IsSuspended = request.IsSuspended;
        await db.SaveChangesAsync(ct);
        
        // Notify user of role change
        await notificationService.NotifyUserRoleChangedAsync(user.Id, oldRole, string.Join(", ", await accessControlService.GetRoleKeysAsync(user.Id, ct)));

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "UpdateUserRole",
            $"Admin updated access roles for {user.DisplayName}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { oldRole, request.RoleIds, request.IsSuspended }),
            ct);
        
        return Ok(await ToDtoAsync(user, ct));
    }

    [HttpDelete("users/{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        var user = await db.TestUsers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null)
        {
            return NotFound(new { error = "User not found." });
        }

        var currentUserIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(currentUserIdValue, out var currentUserId) && currentUserId == id)
        {
            return Conflict(new { error = "You cannot delete your own account." });
        }

        db.TestUsers.Remove(user);
        await db.SaveChangesAsync(ct);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "DeleteUser",
            $"Admin deleted user {user.DisplayName}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status204NoContent,
            Metadata: new { user.UserName }),
            ct);
        return NoContent();
    }

    private async Task<AuthUserDto> ToDtoAsync(TestUser user, CancellationToken ct, DateTime? lastSeenAt = null)
    {
        var assignments = await db.UserAccessRoles.AsNoTracking().Where(value => value.UserId == user.Id)
            .Select(value => new { value.RoleId, value.Role.Name, Capabilities = value.Role.RoleCapabilities.Select(capability => capability.Capability) }).ToListAsync(ct);
        var effectiveLastSeen = lastSeenAt is null || (user.LastLoginAt.HasValue && user.LastLoginAt > lastSeenAt) ? user.LastLoginAt : lastSeenAt;
        return new AuthUserDto(user.Id, user.UserName, user.DisplayName, user.Role, user.IsApproved, user.IsAdmin, user.CreatedAt, user.ApprovedAt, user.ApprovedByUserName, user.LastLoginAt, effectiveLastSeen, user.IsSuspended, assignments.Select(value => value.RoleId).ToList(), assignments.Select(value => value.Name).ToList(), assignments.SelectMany(value => value.Capabilities).Distinct().OrderBy(value => value).ToList());
    }
}
