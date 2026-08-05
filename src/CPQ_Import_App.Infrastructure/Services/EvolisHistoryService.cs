using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Services;

public sealed class EvolisHistoryService(AppDbContext db) : IEvolisHistoryService
{
    public async Task<EvolisDecryptionRun> StartAsync(string fileName, long fileSize, string fileHash,
        string? sourceContentType, byte[] sourceFileContent,
        string userId, string userDisplayName, CancellationToken ct = default)
    {
        var run = new EvolisDecryptionRun
        {
            FileName = fileName,
            FileSize = fileSize,
            FileHash = fileHash,
            SourceContentType = string.IsNullOrWhiteSpace(sourceContentType) ? "application/octet-stream" : sourceContentType,
            SourceFileContent = sourceFileContent,
            HasSourceFile = true,
            UserId = userId,
            UserDisplayName = userDisplayName
        };
        db.EvolisDecryptionRuns.Add(run);
        await db.SaveChangesAsync(ct);
        return run;
    }

    public Task CompleteAsync(Guid id, string outputFormat, string decryptedContent, CancellationToken ct = default)
        => FinishAsync(id, EvolisDecryptionStatus.Successful, outputFormat, decryptedContent, null, ct);

    public Task FailAsync(Guid id, string reason, CancellationToken ct = default)
        => FinishAsync(id, EvolisDecryptionStatus.Failed, null, null, NormalizeFailure(reason), ct);

    public async Task<(IReadOnlyList<EvolisDecryptionRun> Items, int Total)> GetPagedAsync(
        string? userId, int page, int pageSize, string? search, EvolisDecryptionStatus? status,
        bool includeDeleted = false, bool deletedOnly = false, CancellationToken ct = default)
    {
        var query = db.EvolisDecryptionRuns.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(userId)) query = query.Where(run => run.UserId == userId);
        if (deletedOnly) query = query.Where(run => run.IsDeleted);
        else
        {
            if (!includeDeleted || status.HasValue) query = query.Where(run => !run.IsDeleted);
            if (status.HasValue) query = query.Where(run => run.Status == status.Value);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(run => EF.Functions.Like(run.FileName, $"%{term}%")
                || EF.Functions.Like(run.UserDisplayName, $"%{term}%"));
        }

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(run => run.StartedAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(run => new EvolisDecryptionRun
            {
                Id = run.Id,
                FileName = run.FileName,
                FileSize = run.FileSize,
                FileHash = run.FileHash,
                UserId = run.UserId,
                UserDisplayName = run.UserDisplayName,
                StartedAtUtc = run.StartedAtUtc,
                CompletedAtUtc = run.CompletedAtUtc,
                Status = run.Status,
                OutputFormat = run.OutputFormat,
                FailureReason = run.FailureReason,
                HasSourceFile = run.HasSourceFile,
                HasResult = run.HasResult,
                IsDeleted = run.IsDeleted,
                DeletedAtUtc = run.DeletedAtUtc,
                DeletedByUserId = run.DeletedByUserId,
                DeletedByDisplayName = run.DeletedByDisplayName
            })
            .ToListAsync(ct);
        return (items, total);
    }

    public async Task<EvolisDecryptionMetrics> GetMetricsAsync(string? userId, CancellationToken ct = default)
    {
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var query = db.EvolisDecryptionRuns.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(userId)) query = query.Where(run => run.UserId == userId);
        var visibleQuery = string.IsNullOrWhiteSpace(userId) ? query : query.Where(run => !run.IsDeleted);
        var total = await visibleQuery.CountAsync(ct);
        var thisMonth = await visibleQuery.CountAsync(run => run.StartedAtUtc >= monthStart, ct);
        var successful = await query.CountAsync(run => !run.IsDeleted && run.Status == EvolisDecryptionStatus.Successful, ct);
        var failed = await query.CountAsync(run => !run.IsDeleted && run.Status == EvolisDecryptionStatus.Failed, ct);
        var failedThisMonth = await query.CountAsync(run => !run.IsDeleted && run.StartedAtUtc >= monthStart && run.Status == EvolisDecryptionStatus.Failed, ct);
        var deleted = string.IsNullOrWhiteSpace(userId) ? await query.CountAsync(run => run.IsDeleted, ct) : 0;
        return new EvolisDecryptionMetrics(total, thisMonth, successful, failed, failedThisMonth, deleted);
    }

    public Task<EvolisDecryptionRun?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.EvolisDecryptionRuns.AsNoTracking().FirstOrDefaultAsync(run => run.Id == id, ct);

    public async Task<bool> SoftDeleteAsync(Guid id, string ownerUserId, string deletedByDisplayName, CancellationToken ct = default)
    {
        var run = await db.EvolisDecryptionRuns.FirstOrDefaultAsync(
            item => item.Id == id && item.UserId == ownerUserId && !item.IsDeleted, ct);
        if (run is null) return false;

        run.IsDeleted = true;
        run.DeletedAtUtc = DateTime.UtcNow;
        run.DeletedByUserId = ownerUserId;
        run.DeletedByDisplayName = deletedByDisplayName;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> PermanentlyDeleteAsync(Guid id, CancellationToken ct = default)
    {
        if (db.Database.IsRelational())
            return await db.EvolisDecryptionRuns.Where(run => run.Id == id && run.IsDeleted).ExecuteDeleteAsync(ct) == 1;

        var run = await db.EvolisDecryptionRuns.FirstOrDefaultAsync(item => item.Id == id && item.IsDeleted, ct);
        if (run is null) return false;
        db.EvolisDecryptionRuns.Remove(run);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> ResetAsync(CancellationToken ct = default)
    {
        if (db.Database.IsRelational())
        {
            return await db.EvolisDecryptionRuns.ExecuteDeleteAsync(ct);
        }

        var runs = await db.EvolisDecryptionRuns.ToListAsync(ct);
        db.EvolisDecryptionRuns.RemoveRange(runs);
        await db.SaveChangesAsync(ct);
        return runs.Count;
    }

    private async Task FinishAsync(Guid id, EvolisDecryptionStatus status, string? outputFormat,
        string? decryptedContent, string? failureReason, CancellationToken ct)
    {
        var run = await db.EvolisDecryptionRuns.FirstOrDefaultAsync(item => item.Id == id, ct)
            ?? throw new KeyNotFoundException($"Evolis decryption run '{id}' was not found.");
        run.Status = status;
        run.OutputFormat = outputFormat;
        run.DecryptedContent = decryptedContent;
        run.HasResult = !string.IsNullOrEmpty(decryptedContent);
        run.FailureReason = failureReason;
        run.CompletedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static string NormalizeFailure(string reason)
    {
        var value = string.IsNullOrWhiteSpace(reason) ? "Decryption failed." : reason.Trim();
        return value.Length <= 1000 ? value : value[..1000];
    }
}
