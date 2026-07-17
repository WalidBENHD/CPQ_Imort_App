using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Core.Interfaces;

public interface IEvolisHistoryService
{
    Task<EvolisDecryptionRun> StartAsync(string fileName, long fileSize, string fileHash,
        string userId, string userDisplayName, CancellationToken ct = default);
    Task CompleteAsync(Guid id, string outputFormat, CancellationToken ct = default);
    Task FailAsync(Guid id, string reason, CancellationToken ct = default);
    Task<(IReadOnlyList<EvolisDecryptionRun> Items, int Total)> GetPagedAsync(
        string? userId, int page, int pageSize, string? search, EvolisDecryptionStatus? status,
        CancellationToken ct = default);
    Task<EvolisDecryptionMetrics> GetMetricsAsync(string? userId, CancellationToken ct = default);
}

public record EvolisDecryptionMetrics(int Total, int ThisMonth, int Successful, int Failed, int FailedThisMonth);
