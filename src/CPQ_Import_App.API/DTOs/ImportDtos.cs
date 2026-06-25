using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.API.DTOs;

public record ImportJobDto(
    Guid Id,
    string OriginalFileName,
    EntityType EntityType,
    string EntityTypeLabel,
    ImportStatus Status,
    string StatusLabel,
    string CreatedBy,
    string CreatedByDisplayName,
    DateTime CreatedAt,
    DateTime? ProcessedAt,
    DateTime? CommittedAt,
    string? CommittedBy,
    string? RejectedBy,
    DateTime? RejectedAt,
    string? RejectionReason,
    int TotalRows,
    int ValidRows,
    int WarningRows,
    int ErrorRows,
    int CommittedRows
);

public record StagingRowDto(
    Guid Id,
    int RowNumber,
    RowStatus Status,
    string StatusLabel,
    Dictionary<string, string?> Fields,
    List<ValidationMessageDto> ValidationMessages
);

public record ValidationMessageDto(string Field, string Message, string Severity);

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public record UploadRequest(string EntityType);

public record RejectRequest(string Reason);

public record CommitResultDto(Guid JobId, int CommittedRows, string Message);
