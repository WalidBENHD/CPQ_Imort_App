using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.API.DTOs;

public record ImportJobDto(
    Guid Id,
    string OriginalFileName,
    string FileExtension,
    EntityType EntityType,
    string EntityTypeLabel,
    ImportStatus Status,
    string StatusLabel,
    ImportWorkflowStage WorkflowStage,
    string WorkflowStageLabel,
    string CreatedBy,
    string CreatedByDisplayName,
    DateTime CreatedAt,
    DateTime? ProcessedAt,
    DateTime? SubmittedAt,
    string? SubmittedByUserId,
    string? SubmittedByDisplayName,
    DateTime? WithdrawnAt,
    DateTime? ApprovedAt,
    string? ApprovedByUserId,
    string? ApprovedByDisplayName,
    DateTime? CommittedAt,
    string? CommittedBy,
    string? RejectedBy,
    DateTime? RejectedAt,
    string? RejectionReason,
    int TotalRows,
    int ValidRows,
    int WarningRows,
    int ErrorRows,
    int CommittedRows,
    bool IsActiveBaseline,
    int DraftAddedRows,
    int DraftModifiedRows,
    int DraftRemovedRows,
    Guid? ValidationAnchorJobId,
    ValidationAnchorKind ValidationAnchorKind,
    DateTime? ValidationAnchorPinnedAt,
    Guid? ReleasePackageId,
    string? ReleasePackageName
);

public record StagingRowDto(
    Guid Id,
    int RowNumber,
    RowStatus Status,
    string StatusLabel,
    Dictionary<string, string?> Fields,
    List<ValidationMessageDto> ValidationMessages,
    bool IsUserAdded,
    bool IsUserModified,
    bool IsDeleted,
    DateTime? DeletedAt,
    string? DeletedByDisplayName
);

public record ValidationMessageDto(string Field, string Message, string Severity);

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public record UploadRequest(string EntityType);

public record CopyToWorkspaceRequest(string FileName);

public record RenameImportRequest(string Name);

public record RejectRequest(string Reason);

public record UpdateRowRequest(Dictionary<string, string?> Fields);
public record AddRowRequest(Dictionary<string, string?> Fields);
public record BulkRowRequest(IReadOnlyList<Guid> RowIds);
public record ApplyValidationAnchorRequest(Guid ArticleMasterJobId);
public record CreateReleasePackageRequest(Guid? ArticleMasterJobId, Guid? PriceListJobId, string Name);

public record PublicationResultDto(Guid JobId, int PublishedRows, string Message);

public record ValidationAnchorSummaryDto(
    Guid JobId,
    string FileName,
    string VersionLabel,
    DateTime? PublishedAt,
    int ArticleCount,
    bool IsActive,
    bool IsReleaseCandidate);

public record ArticleMasterCandidateSummaryDto(
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

public record PriceListCandidateSummaryDto(
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

public record DependencyImpactDto(
    int TotalRows,
    int ValidReferences,
    int MissingReferences,
    int ArticlesWithoutDependentData,
    IReadOnlyList<string> MissingArticleNumbers);

public record PortfolioReadinessDto(
    Guid JobId,
    EntityType CandidateType,
    Guid? ProjectedMasterJobId,
    Guid? ProjectedPriceJobId,
    int MasterArticleCount,
    int PricedArticleCount,
    bool IsConsistent,
    bool RequiresCoordinatedRelease,
    int ArticlesWithoutPricesCount,
    int PricesWithoutArticlesCount,
    IReadOnlyList<string> ArticlesWithoutPrices,
    IReadOnlyList<string> PricesWithoutArticles);

public record DependencyContextDto(
    Guid JobId,
    bool IsDependentDataset,
    ValidationAnchorKind AnchorKind,
    DateTime? PinnedAt,
    ValidationAnchorSummaryDto? CurrentAnchor,
    ValidationAnchorSummaryDto? LatestActiveMaster,
    bool HasNewerMaster,
    DependencyImpactDto CurrentImpact,
    DependencyImpactDto? LatestImpact,
    ReleasePackageDto? ReleasePackage,
    PortfolioReadinessDto? ProjectedReadiness,
    IReadOnlyList<ArticleMasterCandidateSummaryDto> CandidateMasters);

public record ReleasePackageItemDto(
    Guid JobId,
    EntityType EntityType,
    string DatasetName,
    string FileName,
    ImportStatus Status,
    ImportWorkflowStage WorkflowStage,
    int TotalRows,
    int ErrorRows,
    bool IsValidationAnchor);

public record ReleasePackageDto(
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
    IReadOnlyList<ReleasePackageItemDto> Items);

public record ComparisonFieldChangeDto(
    string Field,
    string? CurrentValue,
    string? BaselineValue,
    bool IsDifferent);

public record ComparisonRowDto(
    Guid RowId,
    int RowNumber,
    string Key,
    string ComparisonStatus,
    int ChangedFieldCount,
    IReadOnlyList<ComparisonFieldChangeDto> Changes);

public record ComparisonMissingItemDto(
    string Key,
    IReadOnlyDictionary<string, string?> BaselineValues);

public record ImportComparisonDto(
    Guid JobId,
    Guid BaselineJobId,
    EntityType EntityType,
    string EntityTypeLabel,
    bool HasBaseline,
    int ComparedRows,
    int NewRows,
    int ModifiedRows,
    int UnchangedRows,
    int MissingBaselineRows,
    IReadOnlyList<ComparisonRowDto> Rows,
    IReadOnlyList<ComparisonMissingItemDto> MissingRows);

public record ApprovedComparisonSnapshotDto(
    int SchemaVersion,
    DateTime ApprovedAtUtc,
    string ApprovedByUserId,
    string ApprovedByDisplayName,
    ImportComparisonDto Comparison);

public record DashboardSummaryDto(
    int AwaitingApproval,
    int CommittedToday,
    int Rejected,
    int TotalSubmissions,
    int OpenExceptions,
    int AgingApprovals);

public record DashboardAttentionDto(
    Guid? JobId,
    string Title,
    string Dataset,
    string Message,
    string Severity,
    string? ActionLabel,
    DateTime? OccurredAt);

public record DashboardDatasetHealthDto(
    EntityType EntityType,
    string DatasetName,
    string Owner,
    string Status,
    string CurrentVersion,
    int TotalSubmissions,
    int OpenItems,
    int ErrorRows,
    double ErrorRate,
    DateTime? LastActivityAt);

public record DashboardActivityDto(
    Guid JobId,
    string Action,
    string Title,
    string Dataset,
    string PerformedByDisplayName,
    DateTime PerformedAt,
    string? Details);

public record DashboardOverviewDto(
    DashboardSummaryDto Summary,
    IReadOnlyList<DashboardAttentionDto> AttentionItems,
    IReadOnlyList<DashboardDatasetHealthDto> DatasetHealth,
    IReadOnlyList<DashboardActivityDto> ActivityFeed,
    IReadOnlyList<ImportJobDto> RecentSubmissions,
    EvolisDecryptionMetricsDto? EvolisMetrics);

public record DatasetColumnRequirementDto(
    string Name,
    bool Required,
    string DataType,
    string Description,
    string? Example);

public record DatasetValidationRuleDto(
    string Field,
    string Rule,
    string Severity);

public record DatasetRequirementDto(
    EntityType EntityType,
    string EntityTypeLabel,
    string DisplayName,
    string Owner,
    string TemplateName,
    string CurrentVersion,
    string Description,
    IReadOnlyList<DatasetColumnRequirementDto> Columns,
    IReadOnlyList<DatasetValidationRuleDto> ValidationRules);

public record DataResetResponseDto(
    string Message,
    string PreservedTable,
    IReadOnlyList<string> ClearedImportTables,
    IReadOnlyList<string> ClearedCpqTables);
