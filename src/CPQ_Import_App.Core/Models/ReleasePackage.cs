using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public class ReleasePackage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public ReleasePackageStatus Status { get; set; } = ReleasePackageStatus.Draft;
    public string CreatedBy { get; set; } = string.Empty;
    public string CreatedByDisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public string? SubmittedByDisplayName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByDisplayName { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectedByUserId { get; set; }
    public string? RejectedByDisplayName { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? PublishedByDisplayName { get; set; }
    public string? FailureReason { get; set; }
    public string? ApprovalEvidenceJson { get; set; }
    public ICollection<ImportJob> Jobs { get; set; } = new List<ImportJob>();
}
