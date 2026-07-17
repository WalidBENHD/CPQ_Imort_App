using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.API.DTOs;

public record EvolisDecryptResponseDto(
    Guid RunId,
    string SourceFileName,
    string DownloadFileName,
    string Content
);

public record EvolisDecryptionRunDto(
    Guid Id,
    string FileName,
    long FileSize,
    string UserId,
    string UserDisplayName,
    DateTime StartedAtUtc,
    DateTime? CompletedAtUtc,
    EvolisDecryptionStatus Status,
    string StatusLabel,
    string? OutputFormat,
    string? FailureReason);

public record EvolisDecryptionHistoryDto(
    IReadOnlyList<EvolisDecryptionRunDto> Items,
    int Total,
    int Page,
    int PageSize);

public record EvolisDecryptionMetricsDto(int Total, int ThisMonth, int Successful, int Failed, int FailedThisMonth);
