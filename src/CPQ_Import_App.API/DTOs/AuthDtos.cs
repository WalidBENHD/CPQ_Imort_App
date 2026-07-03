namespace CPQ_Import_App.API.DTOs;

public record RegisterRequest(string UserName, string DisplayName, string Password);

public record LoginRequest(string UserName, string Password);

public record ApproveUserRequest(string? Role, bool IsAdmin);

public record UpdateUserRoleRequest(string Role, bool IsAdmin);

public record AdminCreateUserRequest(
    string UserName,
    string DisplayName,
    string Password,
    string Role,
    bool IsAdmin,
    bool IsApproved
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
    DateTime? LastSeenAt
);

public record AuthTokenResponse(string AccessToken, DateTime ExpiresAtUtc, AuthUserDto User);
