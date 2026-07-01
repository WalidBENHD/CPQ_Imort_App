using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public class ActivityEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
    public ActivityCategory Category { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? UserId { get; set; }
    public string? UserDisplayName { get; set; }
    public string? UserRole { get; set; }
    public string? TargetType { get; set; }
    public string? TargetId { get; set; }
    public string? Route { get; set; }
    public string? HttpMethod { get; set; }
    public int? StatusCode { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Country { get; set; }
    public string? City { get; set; }
    public string? MetadataJson { get; set; }
}
