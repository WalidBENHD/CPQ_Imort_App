using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Services;

public sealed class EvolisHistoryService(AppDbContext db) : IEvolisHistoryService
{
    public async Task<EvolisDecryptionRun> StartAsync(string fileName, long fileSize, string fileHash,
        string userId, string userDisplayName, CancellationToken ct = default)
    {
        var run = new EvolisDecryptionRun
        {
            FileName = fileName,
            FileSize = fileSize,
            FileHash = fileHash,
            UserId = userId,
            UserDisplayName = userDisplayName
        };
        db.EvolisDecryptionRuns.Add(run);
        await db.SaveChangesAsync(ct);
        return run;
    }

    public Task CompleteAsync(Guid id, string outputFormat, CancellationToken ct = default)
        => FinishAsync(id, EvolisDecryptionStatus.Successful, outputFormat, null, ct);

    public Task FailAsync(Guid id, string reason, CancellationToken ct = default)
        => FinishAsync(id, EvolisDecryptionStatus.Failed, null, NormalizeFailure(reason), ct);

    public async Task<(IReadOnlyList<EvolisDecryptionRun> Items, int Total)> GetPagedAsync(
        string? userId, int page, int pageSize, string? search, EvolisDecryptionStatus? status,
        CancellationToken ct = default)
    {
        var query = db.EvolisDecryptionRuns.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(userId)) query = query.Where(run => run.UserId == userId);
        if (status.HasValue) query = query.Where(run => run.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(run => EF.Functions.Like(run.FileName, $"%{term}%")
                || EF.Functions.Like(run.UserDisplayName, $"%{term}%"));
        }

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(run => run.StartedAtUtc)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return (items, total);
    }

    public async Task<EvolisDecryptionMetrics> GetMetricsAsync(string? userId, CancellationToken ct = default)
    {
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var query = db.EvolisDecryptionRuns.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(userId)) query = query.Where(run => run.UserId == userId);
        var total = await query.CountAsync(ct);
        var thisMonth = await query.CountAsync(run => run.StartedAtUtc >= monthStart, ct);
        var successful = await query.CountAsync(run => run.Status == EvolisDecryptionStatus.Successful, ct);
        var failed = await query.CountAsync(run => run.Status == EvolisDecryptionStatus.Failed, ct);
        var failedThisMonth = await query.CountAsync(run => run.StartedAtUtc >= monthStart && run.Status == EvolisDecryptionStatus.Failed, ct);
        return new EvolisDecryptionMetrics(total, thisMonth, successful, failed, failedThisMonth);
    }

    private async Task FinishAsync(Guid id, EvolisDecryptionStatus status, string? outputFormat, string? failureReason, CancellationToken ct)
    {
        var run = await db.EvolisDecryptionRuns.FirstOrDefaultAsync(item => item.Id == id, ct)
            ?? throw new KeyNotFoundException($"Evolis decryption run '{id}' was not found.");
        run.Status = status;
        run.OutputFormat = outputFormat;
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
