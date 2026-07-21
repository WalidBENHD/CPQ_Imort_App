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

public sealed record ArticleMasterCandidateSummary(
    Guid JobId,
    string FileName,
    string VersionLabel,
    DateTime CreatedAt,
    DateTime? PublishedAt,
    int ArticleCount,
    bool IsActive,
    string Source,
    string OwnerDisplayName,
    ImportStatus Status,
    ImportWorkflowStage WorkflowStage,
    int ErrorRows,
    bool IsEligible,
    bool RequiresWorkingCopy,
    string? IneligibleReason,
    int ValidReferences,
    int MissingReferences);

public sealed record PriceListCandidateSummary(
    Guid JobId,
    string FileName,
    string VersionLabel,
    DateTime CreatedAt,
    DateTime? PublishedAt,
    int PriceCount,
    bool IsActive,
    string Source,
    string OwnerDisplayName,
    ImportStatus Status,
    ImportWorkflowStage WorkflowStage,
    int ErrorRows,
    bool IsEligible,
    bool RequiresWorkingCopy,
    string? IneligibleReason,
    int MatchedArticles,
    int ArticlesWithoutPrices,
    int PricesWithoutArticles);

public sealed record DependencyImpact(
    int TotalRows,
    int ValidReferences,
    int MissingReferences,
    int ArticlesWithoutDependentData,
    IReadOnlyList<string> MissingArticleNumbers);

public sealed record PortfolioReadiness(
    Guid JobId,
    EntityType CandidateType,
    Guid? ProjectedMasterJobId,
    Guid? ProjectedPriceJobId,
    int MasterArticleCount,
    int PricedArticleCount,
    IReadOnlyList<string> ArticlesWithoutPrices,
    IReadOnlyList<string> PricesWithoutArticles)
{
    public bool IsConsistent => ArticlesWithoutPrices.Count == 0 && PricesWithoutArticles.Count == 0;
    public bool RequiresCoordinatedRelease => !IsConsistent;
}

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
    PortfolioReadiness? ProjectedReadiness,
    IReadOnlyList<ArticleMasterCandidateSummary> CandidateMasters);

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
    DateTime? RejectedAt,
    string? RejectedByDisplayName,
    string? RejectionReason,
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

public sealed record MaintenanceDraft(
    IReadOnlyList<ImportJob> Jobs,
    ReleasePackageSummary? ReleasePackage);
