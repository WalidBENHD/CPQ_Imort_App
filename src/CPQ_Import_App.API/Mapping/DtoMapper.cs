using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.API.DTOs;
using System.Text.Json;

namespace CPQ_Import_App.API.Mapping;

public static class DtoMapper
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = false };

    public static ImportJobDto ToDto(this ImportJob job) => new(
        job.Id,
        job.OriginalFileName,
        job.EntityType,
        job.EntityType.ToString(),
        job.Status,
        job.Status.ToString(),
        job.CreatedBy,
        job.CreatedByDisplayName,
        job.CreatedAt,
        job.ProcessedAt,
        job.CommittedAt,
        job.CommittedBy,
        job.RejectedBy,
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
}
