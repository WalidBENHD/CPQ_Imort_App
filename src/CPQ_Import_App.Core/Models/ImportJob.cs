using System.ComponentModel.DataAnnotations.Schema;
using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public class ImportJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public EntityType EntityType { get; set; }
    public ImportStatus Status { get; set; } = ImportStatus.Pending;
    public ImportWorkflowStage WorkflowStage { get; set; } = ImportWorkflowStage.Private;
    public DateTime? SubmittedAt { get; set; }
    public string? SubmittedByUserId { get; set; }
    public string? SubmittedByDisplayName { get; set; }
    public string? SubmittedComparisonJson { get; set; }
    public DateTime? WithdrawnAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string CreatedByDisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public DateTime? CommittedAt { get; set; }
    public string? CommittedBy { get; set; }
    public string? RejectedBy { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int WarningRows { get; set; }
    public int ErrorRows { get; set; }
    public int CommittedRows { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByDisplayName { get; set; }
    public string? ApprovedComparisonJson { get; set; }
    public Guid? ValidationAnchorJobId { get; set; }
    public ValidationAnchorKind ValidationAnchorKind { get; set; }
    public DateTime? ValidationAnchorPinnedAt { get; set; }
    public Guid? ReleasePackageId { get; set; }
    public ReleasePackage? ReleasePackage { get; set; }
    [NotMapped]
    public bool IsActiveBaseline { get; set; }

    [NotMapped]
    public int DraftAddedRows { get; set; }

    [NotMapped]
    public int DraftModifiedRows { get; set; }

    [NotMapped]
    public int DraftRemovedRows { get; set; }
    public ICollection<StagingRow> StagingRows { get; set; } = new List<StagingRow>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
