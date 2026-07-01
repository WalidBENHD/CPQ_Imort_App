using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Repositories;

public interface IActivityRepository
{
    Task<ActivityEvent> AddAsync(ActivityEvent activityEvent, CancellationToken ct = default);
    Task<(IReadOnlyList<ActivityEvent> Items, int Total)> GetPagedAsync(
        int page,
        int pageSize,
        DateTime? fromUtc,
        DateTime? toUtc,
        string? userId,
        string? excludeUserId,
        ActivityCategory? category,
        string? action,
        string? search,
        int? statusCode,
        CancellationToken ct = default);
    Task<int> DeleteOlderThanAsync(DateTime cutoffUtc, CancellationToken ct = default);
    Task<int> CountSinceAsync(DateTime sinceUtc, ActivityCategory? category = null, CancellationToken ct = default);
    Task<int> CountFailuresSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
}

public class ActivityRepository(AppDbContext db) : IActivityRepository
{
    public async Task<ActivityEvent> AddAsync(ActivityEvent activityEvent, CancellationToken ct = default)
    {
        db.ActivityEvents.Add(activityEvent);
        await db.SaveChangesAsync(ct);
        return activityEvent;
    }

    public async Task<(IReadOnlyList<ActivityEvent> Items, int Total)> GetPagedAsync(
        int page,
        int pageSize,
        DateTime? fromUtc,
        DateTime? toUtc,
        string? userId,
        string? excludeUserId,
        ActivityCategory? category,
        string? action,
        string? search,
        int? statusCode,
        CancellationToken ct = default)
    {
        IQueryable<ActivityEvent> query = db.ActivityEvents.AsNoTracking();

        if (fromUtc.HasValue)
        {
            query = query.Where(x => x.OccurredAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(x => x.OccurredAtUtc <= toUtc.Value);
        }

        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(x => x.UserId == userId);
        }

        if (!string.IsNullOrWhiteSpace(excludeUserId))
        {
            query = query.Where(x => x.UserId != excludeUserId);
        }

        if (category.HasValue)
        {
            query = query.Where(x => x.Category == category.Value);
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(x => x.Action == action);
        }

        if (statusCode.HasValue)
        {
            query = query.Where(x => x.StatusCode == statusCode.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                (x.UserDisplayName != null && EF.Functions.Like(x.UserDisplayName, $"%{term}%")) ||
                (x.UserId != null && EF.Functions.Like(x.UserId, $"%{term}%")) ||
                (x.Action != null && EF.Functions.Like(x.Action, $"%{term}%")) ||
                (x.Description != null && EF.Functions.Like(x.Description, $"%{term}%")) ||
                (x.Route != null && EF.Functions.Like(x.Route, $"%{term}%")) ||
                (x.Country != null && EF.Functions.Like(x.Country, $"%{term}%")) ||
                (x.City != null && EF.Functions.Like(x.City, $"%{term}%")));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.OccurredAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<int> DeleteOlderThanAsync(DateTime cutoffUtc, CancellationToken ct = default)
        => db.ActivityEvents
            .Where(x => x.OccurredAtUtc < cutoffUtc)
            .ExecuteDeleteAsync(ct);

    public Task<int> CountSinceAsync(DateTime sinceUtc, ActivityCategory? category = null, CancellationToken ct = default)
    {
        var query = db.ActivityEvents.AsNoTracking().Where(x => x.OccurredAtUtc >= sinceUtc);
        if (category.HasValue)
        {
            query = query.Where(x => x.Category == category.Value);
        }

        return query.CountAsync(ct);
    }

    public Task<int> CountFailuresSinceAsync(DateTime sinceUtc, CancellationToken ct = default)
        => db.ActivityEvents
            .AsNoTracking()
            .Where(x => x.OccurredAtUtc >= sinceUtc && x.StatusCode.HasValue && x.StatusCode.Value >= 400)
            .CountAsync(ct);
}
