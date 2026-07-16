namespace CPQ_Import_App.API.DTOs;

public record RegisterRequest(string UserName, string DisplayName, string Password);

public record LoginRequest(string UserName, string Password);

public record ApproveUserRequest(IReadOnlyList<Guid>? RoleIds);

public record UpdateUserRoleRequest(IReadOnlyList<Guid> RoleIds, bool IsSuspended = false);

public record AdminCreateUserRequest(
    string UserName,
    string DisplayName,
    string Password,
    bool IsApproved,
    IReadOnlyList<Guid>? RoleIds
);

public record AuthUserDto(
    Guid Id,
    string UserName,
    string DisplayName,
    string Role,
    bool IsApproved,
    bool IsAdmin,
    DateTime CreatedAt,
    DateTime? ApprovedAt,
    string? ApprovedByUserName,
    DateTime? LastLoginAt,
    DateTime? LastSeenAt,
    bool IsSuspended,
    IReadOnlyList<Guid> RoleIds,
    IReadOnlyList<string> RoleNames,
    IReadOnlyList<string> Capabilities
);

public record AccessRoleDto(Guid Id, string Key, string Name, string Description, string Icon, string Color, bool IsSystem, IReadOnlyList<string> Capabilities, int AssignedUsers);
public record SaveAccessRoleRequest(string Name, string Description, string Icon, string Color, IReadOnlyList<string> Capabilities);
public record UpdateUserAccessRequest(bool IsApproved, bool IsSuspended, IReadOnlyList<Guid> RoleIds);

public record AuthTokenResponse(string AccessToken, DateTime ExpiresAtUtc, AuthUserDto User);
