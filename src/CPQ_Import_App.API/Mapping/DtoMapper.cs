using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.Infrastructure.Services;
using System.Text.Json;

namespace CPQ_Import_App.API.Mapping;

public static class DtoMapper
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = false };
    private static string DisplayName(string fileName) => Path.GetFileNameWithoutExtension(fileName);

    private static string? ResolveActorDisplayName(ImportJob job, string? actor, string action)
    {
        var shouldResolve = string.IsNullOrWhiteSpace(actor) || Guid.TryParse(actor, out _);
        if (!shouldResolve)
        {
            return actor;
        }

        var displayName = job.AuditLogs
            .Where(a => a.Action.Equals(action, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(a => a.PerformedAt)
            .Select(a => a.PerformedByDisplayName)
            .FirstOrDefault();

        return string.IsNullOrWhiteSpace(displayName) ? actor : displayName;
    }

    public static ImportJobDto ToDto(this ImportJob job) => new(
        job.Id,
        DisplayName(job.OriginalFileName),
        string.IsNullOrWhiteSpace(Path.GetExtension(job.FileName))
            ? Path.GetExtension(job.OriginalFileName)
            : Path.GetExtension(job.FileName),
        job.EntityType,
        DatasetCatalog.Get(job.EntityType).DisplayName,
        job.Status,
        job.Status.ToString(),
        job.WorkflowStage,
        job.WorkflowStage.ToString(),
        job.CreatedBy,
        job.CreatedByDisplayName,
        job.CreatedAt,
        job.ProcessedAt,
        job.SubmittedAt,
        job.SubmittedByUserId,
        job.SubmittedByDisplayName,
        job.WithdrawnAt,
        job.ApprovedAt,
        job.ApprovedByUserId,
        job.ApprovedByDisplayName,
        job.CommittedAt,
        ResolveActorDisplayName(job, job.CommittedBy, "Committed"),
        ResolveActorDisplayName(job, job.RejectedBy, "Rejected"),
        job.RejectedAt,
        job.RejectionReason,
        job.TotalRows,
        job.ValidRows,
        job.WarningRows,
        job.ErrorRows,
        job.CommittedRows,
        job.IsActiveBaseline,
        job.DraftAddedRows,
        job.DraftModifiedRows,
        job.DraftRemovedRows,
        job.ValidationAnchorJobId,
        job.ValidationAnchorKind,
        job.ValidationAnchorPinnedAt,
        job.ReleasePackageId,
        job.ReleasePackage?.Name
    );

    public static ValidationAnchorSummaryDto ToDto(this ValidationAnchorSummary anchor) => new(
        anchor.JobId, DisplayName(anchor.FileName), anchor.VersionLabel, anchor.PublishedAt,
        anchor.ArticleCount, anchor.IsActive, anchor.IsReleaseCandidate);

    public static ArticleMasterCandidateSummaryDto ToDto(this ArticleMasterCandidateSummary candidate) => new(
        candidate.JobId, DisplayName(candidate.FileName), candidate.VersionLabel, candidate.CreatedAt,
        candidate.PublishedAt, candidate.ArticleCount, candidate.IsActive, candidate.Source,
        candidate.OwnerDisplayName, candidate.Status, candidate.WorkflowStage, candidate.ErrorRows,
        candidate.IsEligible, candidate.RequiresWorkingCopy, candidate.IneligibleReason,
        candidate.ValidReferences, candidate.MissingReferences);

    public static PriceListCandidateSummaryDto ToDto(this PriceListCandidateSummary candidate) => new(
        candidate.JobId, DisplayName(candidate.FileName), candidate.VersionLabel, candidate.CreatedAt,
        candidate.PublishedAt, candidate.PriceCount, candidate.IsActive, candidate.Source,
        candidate.OwnerDisplayName, candidate.Status, candidate.WorkflowStage, candidate.ErrorRows,
        candidate.IsEligible, candidate.RequiresWorkingCopy, candidate.IneligibleReason,
        candidate.MatchedArticles, candidate.ArticlesWithoutPrices, candidate.PricesWithoutArticles);

    public static DependencyImpactDto ToDto(this DependencyImpact impact) => new(
        impact.TotalRows, impact.ValidReferences, impact.MissingReferences,
        impact.ArticlesWithoutDependentData, impact.MissingArticleNumbers);

    public static PortfolioReadinessDto ToDto(this PortfolioReadiness readiness) => new(
        readiness.JobId,
        readiness.CandidateType,
        readiness.ProjectedMasterJobId,
        readiness.ProjectedPriceJobId,
        readiness.MasterArticleCount,
        readiness.PricedArticleCount,
        readiness.IsConsistent,
        readiness.RequiresCoordinatedRelease,
        readiness.ArticlesWithoutPrices.Count,
        readiness.PricesWithoutArticles.Count,
        readiness.ArticlesWithoutPrices.Take(100).ToList(),
        readiness.PricesWithoutArticles.Take(100).ToList());

    public static ReleasePackageItemDto ToDto(this ReleasePackageItemSummary item) => new(
        item.JobId, item.EntityType, item.DatasetName, DisplayName(item.FileName), item.Status,
        item.WorkflowStage, item.TotalRows, item.ErrorRows, item.IsValidationAnchor);

    public static ReleasePackageDto ToDto(this ReleasePackageSummary package) => new(
        package.Id, package.Name, package.Status, package.CreatedBy, package.CreatedByDisplayName,
        package.CreatedAt, package.SubmittedAt, package.SubmittedByDisplayName,
        package.ApprovedAt, package.ApprovedByDisplayName,
        package.RejectedAt, package.RejectedByDisplayName, package.RejectionReason,
        package.PublishedAt, package.PublishedByDisplayName, package.FailureReason,
        package.Items.Select(ToDto).ToList());

    public static DependencyContextDto ToDto(this DependencyContext context) => new(
        context.JobId, context.IsDependentDataset, context.AnchorKind, context.PinnedAt,
        context.CurrentAnchor?.ToDto(), context.LatestActiveMaster?.ToDto(), context.HasNewerMaster,
        context.CurrentImpact.ToDto(), context.LatestImpact?.ToDto(), context.ReleasePackage?.ToDto(),
        context.ProjectedReadiness?.ToDto(),
        context.CandidateMasters.Select(ToDto).ToList());

    public static StagingRowDto ToDto(this StagingRow row) => new(
        row.Id,
        row.RowNumber,
        row.Status,
        row.Status.ToString(),
        row.RawData != null
            ? JsonSerializer.Deserialize<Dictionary<string, string?>>(row.RawData, JsonOpts) ?? []
            : [],
        row.ValidationMessages != null
            ? JsonSerializer.Deserialize<List<ValidationMessage>>(row.ValidationMessages, JsonOpts)
                ?.Select(m => new ValidationMessageDto(m.Field, m.Message, m.Severity.ToString()))
                .ToList() ?? []
            : [],
        row.IsUserAdded,
        row.IsUserModified,
        row.IsDeleted,
        row.DeletedAt,
        row.DeletedByDisplayName
    );

    public static ComparisonFieldChangeDto ToDto(this ComparisonFieldChange change) => new(
        change.Field,
        change.CurrentValue,
        change.BaselineValue,
        change.IsDifferent);

    public static ComparisonRowDto ToDto(this ComparisonRowResult row) => new(
        row.RowId,
        row.RowNumber,
        row.Key,
        row.ComparisonStatus,
        row.ChangedFieldCount,
        row.Changes.Select(x => x.ToDto()).ToList());

    public static ComparisonMissingItemDto ToDto(this ComparisonMissingItem item) => new(
        item.Key,
        item.BaselineValues);

    public static ImportComparisonDto ToDto(this ImportComparisonResult comparison) => new(
        comparison.JobId,
        comparison.BaselineJobId,
        comparison.EntityType,
        comparison.EntityTypeLabel,
        comparison.HasBaseline,
        comparison.ComparedRows,
        comparison.NewRows,
        comparison.ModifiedRows,
        comparison.UnchangedRows,
        comparison.MissingBaselineRows,
        comparison.Rows.Select(x => x.ToDto()).ToList(),
        comparison.MissingRows.Select(x => x.ToDto()).ToList());

    public static ApprovedComparisonSnapshotDto ToDto(this ApprovedComparisonSnapshot snapshot) => new(
        snapshot.SchemaVersion,
        snapshot.ApprovedAtUtc,
        snapshot.ApprovedByUserId,
        snapshot.ApprovedByDisplayName,
        snapshot.Comparison.ToDto());

    public static ActivityEventDto ToDto(this ActivityEvent activity) => new(
        activity.Id,
        activity.OccurredAtUtc,
        activity.Category,
        activity.Category.ToString(),
        activity.Action,
        activity.Description,
        activity.UserId,
        activity.UserDisplayName,
        activity.UserRole,
        activity.TargetType,
        activity.TargetId,
        activity.Route,
        activity.HttpMethod,
        activity.StatusCode,
        activity.IpAddress,
        activity.UserAgent,
        activity.Country,
        activity.City,
        activity.MetadataJson
    );

    public static ActivityOverviewDto ToDto(this ActivityOverview overview) => new(
        overview.TotalLast24h,
        overview.AuthEventsLast24h,
        overview.ImportEventsLast24h,
        overview.FailuresLast24h
    );

    public static DatasetRequirementDto ToDto(this DatasetDefinition dataset) => new(
        dataset.EntityType,
        dataset.EntityType.ToString(),
        dataset.DisplayName,
        dataset.Owner,
        dataset.TemplateName,
        dataset.CurrentVersion,
        dataset.Description,
        dataset.Columns.Select(x => new DatasetColumnRequirementDto(
            x.Name,
            x.Required,
            x.DataType,
            x.Description,
            x.Example)).ToList(),
        dataset.ValidationRules.Select(x => new DatasetValidationRuleDto(
            x.Field,
            x.Rule,
            x.Severity)).ToList()
    );
}
