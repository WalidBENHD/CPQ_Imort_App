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
    ILiveUserPresenceTracker liveUserPresenceTracker) : ControllerBase
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
            var adminIds = await db.TestUsers
                .AsNoTracking()
                .Where(x => x.IsAdmin && x.IsApproved)
                .Select(x => x.Id)
                .ToListAsync(ct);

            if (adminIds.Any())
            {
                await notificationService.NotifyAdminsAboutPendingUserAsync(newUser, adminIds);
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

        var (token, expiresAtUtc) = tokenFactory.CreateToken(user);
        return Ok(new AuthTokenResponse(token, expiresAtUtc, ToDto(user)));
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

        return Ok(ToDto(user));
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

        return Ok(users.Select(x => ToDto(x)).ToList());
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

        return Ok(users.Select(user =>
        {
            activityByUserId.TryGetValue(user.Id.ToString(), out var lastSeenAt);

            var liveLastSeenAt = liveUserPresenceTracker.GetLastSeenUtc(user.Id.ToString());
            if (liveLastSeenAt.HasValue && (!lastSeenAt.HasValue || liveLastSeenAt > lastSeenAt))
            {
                lastSeenAt = liveLastSeenAt;
            }

            return ToDto(user, lastSeenAt);
        }).ToList());
    }

    [HttpPost("users")]
    [Authorize(Policy = "AdminOnly")]
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

        var (hash, salt) = PasswordHasher.HashPassword(request.Password);
        var user = new TestUser
        {
            UserName = request.UserName.Trim(),
            NormalizedUserName = normalized,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? request.UserName.Trim() : request.DisplayName.Trim(),
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = string.IsNullOrWhiteSpace(request.Role) ? "cpq-user" : request.Role.Trim(),
            IsAdmin = request.IsAdmin,
            IsApproved = request.IsApproved,
            ApprovedAt = request.IsApproved ? DateTime.UtcNow : null,
            ApprovedByUserName = request.IsApproved ? CurrentUserName : null
        };

        db.TestUsers.Add(user);
        await db.SaveChangesAsync(ct);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "AdminCreateUser",
            $"Admin created user {user.DisplayName}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { user.UserName, user.Role, user.IsAdmin, user.IsApproved }),
            ct);
        return Ok(ToDto(user));
    }

    [HttpPost("users/{id:guid}/approve")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<AuthUserDto>> Approve(Guid id, [FromBody] ApproveUserRequest request, CancellationToken ct)
    {
        var user = await db.TestUsers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null)
        {
            return NotFound(new { error = "User not found." });
        }

        user.IsApproved = true;
        user.Role = string.IsNullOrWhiteSpace(request.Role) ? "cpq-user" : request.Role.Trim();
        user.IsAdmin = request.IsAdmin;
        user.ApprovedAt = DateTime.UtcNow;
        user.ApprovedByUserName = CurrentUserName;

        await db.SaveChangesAsync(ct);
        
        // Notify user that they were approved
        await notificationService.NotifyUserApprovedAsync(user.Id, CurrentUserName);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "ApproveUser",
            $"Admin approved user {user.DisplayName}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { user.UserName, user.Role, user.IsAdmin }),
            ct);
        
        return Ok(ToDto(user));
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
    public async Task<ActionResult<AuthUserDto>> UpdateRole(Guid id, [FromBody] UpdateUserRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(new { error = "Role is required." });
        }

        var user = await db.TestUsers.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null)
        {
            return NotFound(new { error = "User not found." });
        }

        if (!user.IsApproved)
        {
            return Conflict(new { error = "User must be approved first." });
        }

        var oldRole = user.Role;
        user.Role = request.Role.Trim();
        user.IsAdmin = request.IsAdmin;
        await db.SaveChangesAsync(ct);
        
        // Notify user of role change
        await notificationService.NotifyUserRoleChangedAsync(user.Id, oldRole, user.Role);

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "UpdateUserRole",
            $"Admin updated role for {user.DisplayName} from {oldRole} to {user.Role}.",
            TargetType: "User",
            TargetId: user.Id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { oldRole, newRole = user.Role, user.IsAdmin }),
            ct);
        
        return Ok(ToDto(user));
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

    private static AuthUserDto ToDto(TestUser user, DateTime? lastSeenAt = null) => new(
        user.Id,
        user.UserName,
        user.DisplayName,
        user.Role,
        user.IsApproved,
        user.IsAdmin,
        user.CreatedAt,
        user.ApprovedAt,
        user.ApprovedByUserName,
        user.LastLoginAt,
        lastSeenAt is null || (user.LastLoginAt.HasValue && user.LastLoginAt > lastSeenAt)
            ? user.LastLoginAt
            : lastSeenAt
    );
}
