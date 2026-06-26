using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Repositories;

public class ImportRepository(AppDbContext db) : IImportRepository
{
    public async Task<ImportJob> CreateJobAsync(ImportJob job, CancellationToken ct = default)
    {
        db.ImportJobs.Add(job);
        await db.SaveChangesAsync(ct);
        return job;
    }

    public Task<ImportJob?> GetJobAsync(Guid id, CancellationToken ct = default)
        => db.ImportJobs
            .Include(j => j.AuditLogs)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

    public async Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.ImportJobs.OrderByDescending(j => j.CreatedAt);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (items, total);
    }

    public async Task UpdateJobAsync(ImportJob job, CancellationToken ct = default)
    {
        db.ImportJobs.Update(job);
        await db.SaveChangesAsync(ct);
    }

    public async Task AddStagingRowsAsync(IEnumerable<StagingRow> rows, CancellationToken ct = default)
    {
        await db.StagingRows.AddRangeAsync(rows, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsPagedAsync(
        Guid jobId, int page, int pageSize, RowStatus? filterStatus = null, CancellationToken ct = default)
    {
        var query = db.StagingRows.Where(r => r.ImportJobId == jobId);
        if (filterStatus.HasValue)
            query = query.Where(r => r.Status == filterStatus.Value);
        query = query.OrderBy(r => r.RowNumber);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (items, total);
    }

    public async Task AddAuditLogAsync(AuditLog entry, CancellationToken ct = default)
    {
        db.AuditLogs.Add(entry);
        await db.SaveChangesAsync(ct);
    }

    public async Task<byte[]?> GetUploadedFileAsync(Guid jobId, CancellationToken ct = default)
    {
        var file = await db.UploadedFiles.FindAsync([jobId], ct);
        return file?.Content;
    }

    public async Task SaveUploadedFileAsync(Guid jobId, string fileName, byte[] content, CancellationToken ct = default)
    {
        var file = new UploadedFile { JobId = jobId, FileName = fileName, Content = content };
        db.UploadedFiles.Add(file);
        await db.SaveChangesAsync(ct);
    }
}
