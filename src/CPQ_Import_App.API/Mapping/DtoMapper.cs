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
        job.CreatedBy,
        job.CreatedByDisplayName,
        job.CreatedAt,
        job.ProcessedAt,
        job.CommittedAt,
        ResolveActorDisplayName(job, job.CommittedBy, "Committed"),
        ResolveActorDisplayName(job, job.RejectedBy, "Rejected"),
        job.RejectedAt,
        job.RejectionReason,
        job.TotalRows,
        job.ValidRows,
        job.WarningRows,
        job.ErrorRows,
        job.CommittedRows
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
}
