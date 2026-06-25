using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Core.Interfaces;

public interface IImportRepository
{
    Task<ImportJob> CreateJobAsync(ImportJob job, CancellationToken ct = default);
    Task<ImportJob?> GetJobAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, CancellationToken ct = default);
    Task UpdateJobAsync(ImportJob job, CancellationToken ct = default);
    Task AddStagingRowsAsync(IEnumerable<StagingRow> rows, CancellationToken ct = default);
    Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsPagedAsync(
        Guid jobId, int page, int pageSize, RowStatus? filterStatus = null, CancellationToken ct = default);
    Task AddAuditLogAsync(AuditLog entry, CancellationToken ct = default);
    Task<byte[]?> GetUploadedFileAsync(Guid jobId, CancellationToken ct = default);
    Task SaveUploadedFileAsync(Guid jobId, string fileName, byte[] content, CancellationToken ct = default);
}
