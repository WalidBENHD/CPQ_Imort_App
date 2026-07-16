namespace CPQ_Import_App.Core.Models;

public class AccessRole
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = "shield";
    public string Color { get; set; } = "#2563eb";
    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<RoleCapability> RoleCapabilities { get; set; } = [];
    public ICollection<UserAccessRole> UserRoles { get; set; } = [];
}

public class RoleCapability
{
    public Guid RoleId { get; set; }
    public string Capability { get; set; } = string.Empty;
    public AccessRole Role { get; set; } = null!;
}

public class UserAccessRole
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public TestUser User { get; set; } = null!;
    public AccessRole Role { get; set; } = null!;
}
