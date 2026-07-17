using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Core.Interfaces;

public interface IImportRepository
{
    Task<ImportJob> CreateJobAsync(ImportJob job, CancellationToken ct = default);
    Task<ImportJob> CreateCopiedJobAsync(
        ImportJob job,
        IReadOnlyCollection<StagingRow> rows,
        string uploadedFileName,
        byte[] uploadedFileContent,
        AuditLog auditLog,
        CancellationToken ct = default);
    Task<ImportJob?> GetJobAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, string viewerUserId, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default);
    Task UpdateJobAsync(ImportJob job, CancellationToken ct = default);
    Task DeleteJobAsync(ImportJob job, CancellationToken ct = default);
    Task AddStagingRowsAsync(IEnumerable<StagingRow> rows, CancellationToken ct = default);
    Task<IReadOnlyList<StagingRow>> GetStagingRowsByJobAsync(Guid jobId, CancellationToken ct = default);
    Task<IReadOnlyList<StagingRow>> GetDeletedStagingRowsByJobAsync(Guid jobId, CancellationToken ct = default);
    Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsPagedAsync(
        Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null, ComparisonStatus? comparisonStatus = null, CancellationToken ct = default);
    Task<StagingRow?> GetStagingRowAsync(Guid jobId, Guid rowId, CancellationToken ct = default);
    Task UpdateStagingRowAsync(StagingRow row, CancellationToken ct = default);
    Task AddAuditLogAsync(AuditLog entry, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
    Task<ImportComparisonResult> GetComparisonAsync(Guid jobId, CancellationToken ct = default);
    Task<IReadOnlySet<string>> GetLatestApprovedArticleNumbersAsync(CancellationToken ct = default);
    Task<byte[]?> GetUploadedFileAsync(Guid jobId, CancellationToken ct = default);
    Task SaveUploadedFileAsync(Guid jobId, string fileName, byte[] content, CancellationToken ct = default);
}
