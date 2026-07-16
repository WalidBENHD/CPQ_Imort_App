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
        job.OriginalFileName,
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
        job.IsActiveBaseline
    );

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
            : []
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
