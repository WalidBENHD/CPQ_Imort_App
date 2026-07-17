using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.Core.Models;

public sealed record ValidationAnchorSummary(
    Guid JobId,
    string FileName,
    string VersionLabel,
    DateTime? PublishedAt,
    int ArticleCount,
    bool IsActive,
    bool IsReleaseCandidate);

public sealed record DependencyImpact(
    int TotalRows,
    int ValidReferences,
    int MissingReferences,
    int ArticlesWithoutDependentData,
    IReadOnlyList<string> MissingArticleNumbers);

public sealed record DependencyContext(
    Guid JobId,
    bool IsDependentDataset,
    ValidationAnchorKind AnchorKind,
    DateTime? PinnedAt,
    ValidationAnchorSummary? CurrentAnchor,
    ValidationAnchorSummary? LatestActiveMaster,
    bool HasNewerMaster,
    DependencyImpact CurrentImpact,
    DependencyImpact? LatestImpact,
    ReleasePackageSummary? ReleasePackage,
    IReadOnlyList<ValidationAnchorSummary> CandidateMasters);

public sealed record ReleasePackageSummary(
    Guid Id,
    string Name,
    ReleasePackageStatus Status,
    string CreatedBy,
    string CreatedByDisplayName,
    DateTime CreatedAt,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    string? ApprovedByDisplayName,
    DateTime? PublishedAt,
    string? PublishedByDisplayName,
    string? FailureReason,
    IReadOnlyList<ReleasePackageItemSummary> Items);

public sealed record ReleasePackageItemSummary(
    Guid JobId,
    EntityType EntityType,
    string DatasetName,
    string FileName,
    ImportStatus Status,
    ImportWorkflowStage WorkflowStage,
    int TotalRows,
    int ErrorRows,
    bool IsValidationAnchor);
