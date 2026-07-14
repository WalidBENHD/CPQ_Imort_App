using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Core.Metadata;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace CPQ_Import_App.Infrastructure.Repositories;

public class ImportRepository(AppDbContext db) : IImportRepository
{
    public async Task<ImportJob> CreateJobAsync(ImportJob job, CancellationToken ct = default)
    {
        db.ImportJobs.Add(job);
        await db.SaveChangesAsync(ct);
        return job;
    }

    public async Task<ImportJob?> GetJobAsync(Guid id, CancellationToken ct = default)
    {
        var job = await db.ImportJobs
            .Include(j => j.AuditLogs)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (job is not null)
        {
            await MarkActiveBaselineAsync(job, ct);
        }

        return job;
    }

    public async Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default)
    {
        IQueryable<ImportJob> query = db.ImportJobs.AsNoTracking().OrderByDescending(j => j.CreatedAt);

        if (status.HasValue)
            query = query.Where(j => j.Status == status.Value);

        if (entityType.HasValue)
            query = query.Where(j => j.EntityType == entityType.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(j =>
                EF.Functions.Like(j.OriginalFileName, $"%{term}%") ||
                EF.Functions.Like(j.CreatedByDisplayName, $"%{term}%") ||
                EF.Functions.Like(j.FileName, $"%{term}%"));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        await MarkActiveBaselinesAsync(items, ct);

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

    public async Task<IReadOnlyList<StagingRow>> GetStagingRowsByJobAsync(Guid jobId, CancellationToken ct = default)
        => await db.StagingRows
            .Where(r => r.ImportJobId == jobId)
            .OrderBy(r => r.RowNumber)
            .ToListAsync(ct);

    public async Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsPagedAsync(
        Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null, ComparisonStatus? comparisonStatus = null, CancellationToken ct = default)
    {
        var query = db.StagingRows.AsNoTracking().Where(r => r.ImportJobId == jobId);
        if (filterStatus.HasValue)
            query = query.Where(r => r.Status == filterStatus.Value);

        var items = await query.OrderBy(r => r.RowNumber).ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            items = items.Where(r =>
            {
                if (r.RowNumber.ToString(CultureInfo.InvariantCulture).Contains(term, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                var fields = Deserialize(r.RawData);
                if (fields.Values.Any(value => !string.IsNullOrWhiteSpace(value) && value!.Contains(term, StringComparison.OrdinalIgnoreCase)))
                {
                    return true;
                }

                if (!string.IsNullOrWhiteSpace(r.ValidationMessages) && r.ValidationMessages.Contains(term, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                return false;
            }).ToList();
        }

        if (comparisonStatus.HasValue)
        {
            var comparison = await GetComparisonAsync(jobId, ct);
            var matchingRowIds = comparison.Rows
                .Where(r => Enum.TryParse<ComparisonStatus>(r.ComparisonStatus, ignoreCase: true, out var parsed) && parsed == comparisonStatus.Value)
                .Select(r => r.RowId)
                .ToHashSet();

            items = items.Where(r => matchingRowIds.Contains(r.Id)).ToList();
        }

        var total = items.Count;
        items = items
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
        return (items, total);
    }

    public Task<StagingRow?> GetStagingRowAsync(Guid jobId, Guid rowId, CancellationToken ct = default)
        => db.StagingRows.FirstOrDefaultAsync(r => r.ImportJobId == jobId && r.Id == rowId, ct);

    public async Task UpdateStagingRowAsync(StagingRow row, CancellationToken ct = default)
    {
        db.StagingRows.Update(row);
        await db.SaveChangesAsync(ct);
    }

    public async Task AddAuditLogAsync(AuditLog entry, CancellationToken ct = default)
    {
        db.AuditLogs.Add(entry);
        await db.SaveChangesAsync(ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default)
        => db.SaveChangesAsync(ct);

    public async Task<ImportComparisonResult> GetComparisonAsync(Guid jobId, CancellationToken ct = default)
    {
        var job = await db.ImportJobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        var stagingRows = await db.StagingRows
            .AsNoTracking()
            .Where(r => r.ImportJobId == jobId)
            .OrderBy(r => r.RowNumber)
            .ToListAsync(ct);

        var currentRows = stagingRows.Select(row =>
            new ComparisonRowSource(
                row,
                Deserialize(row.RawData),
                NormalizeJobKey(job.EntityType, Deserialize(row.RawData))))
            .ToList();

        var baselineSnapshot = await LoadBaselineSnapshotAsync(job, ct);
        var baselineLookup = BuildBaselineLookup(job.EntityType, baselineSnapshot);
        var matchedBaselineKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var comparisonRows = new List<ComparisonRowResult>();
        int newRows = 0;
        int modifiedRows = 0;
        int unchangedRows = 0;

        if (baselineLookup.Count == 0)
        {
            var allNewRows = currentRows.Select(current =>
                new ComparisonRowResult(
                    current.Row.Id,
                    current.Row.RowNumber,
                    current.Key,
                    "New",
                    0,
                    BuildChanges(current.Fields, null))).ToList();

            return new ImportComparisonResult(
                job.Id,
                job.Id,
                job.EntityType,
                DatasetCatalog.Get(job.EntityType).DisplayName,
                false,
                currentRows.Count,
                currentRows.Count,
                0,
                0,
                0,
                allNewRows,
                []);
        }

        foreach (var current in currentRows)
        {
            baselineLookup.TryGetValue(current.Key, out var baseline);
            if (baseline is null)
            {
                newRows++;
                comparisonRows.Add(new ComparisonRowResult(
                    current.Row.Id,
                    current.Row.RowNumber,
                    current.Key,
                    "New",
                    0,
                    BuildChanges(current.Fields, null)));
                continue;
            }

            matchedBaselineKeys.Add(current.Key);

            var changes = BuildChanges(current.Fields, baseline);
            var changedCount = changes.Count(change => change.IsDifferent);
            var status = changedCount == 0 ? "Unchanged" : "Modified";
            if (changedCount == 0)
            {
                unchangedRows++;
            }
            else
            {
                modifiedRows++;
            }

            comparisonRows.Add(new ComparisonRowResult(
                current.Row.Id,
                current.Row.RowNumber,
                current.Key,
                status,
                changedCount,
                changes));
        }

        var missingRows = baselineLookup
            .Where(pair => !matchedBaselineKeys.Contains(pair.Key))
            .Select(pair => new ComparisonMissingItem(pair.Key, pair.Value))
            .ToList();

        return new ImportComparisonResult(
            job.Id,
            baselineSnapshot.Value.JobId,
            job.EntityType,
            DatasetCatalog.Get(job.EntityType).DisplayName,
            true,
            comparisonRows.Count,
            newRows,
            modifiedRows,
            unchangedRows,
            missingRows.Count,
            comparisonRows,
            missingRows);
    }

    public async Task<IReadOnlySet<string>> GetLatestApprovedArticleNumbersAsync(CancellationToken ct = default)
    {
        var articleJob = await db.ImportJobs.AsNoTracking()
            .Where(j => j.EntityType == EntityType.Article && j.Status == ImportStatus.Committed)
            .OrderByDescending(j => j.CommittedAt)
            .ThenByDescending(j => j.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (articleJob is null)
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        var rows = await db.StagingRows
            .AsNoTracking()
            .Where(r => r.ImportJobId == articleJob.Id)
            .Select(r => r.RawData)
            .ToListAsync(ct);

        var articleNumbers = rows
            .Select(Deserialize)
            .Select(fields => fields.TryGetValue("ArticleNumber", out var value) ? value?.Trim() : null)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return articleNumbers;
    }

    private async Task MarkActiveBaselinesAsync(IReadOnlyCollection<ImportJob> jobs, CancellationToken ct)
    {
        if (jobs.Count == 0)
        {
            return;
        }

        var activeCommittedJobs = await db.ImportJobs
            .AsNoTracking()
            .Where(j => j.Status == ImportStatus.Committed)
            .OrderByDescending(j => j.CommittedAt)
            .ThenByDescending(j => j.CreatedAt)
            .ToListAsync(ct);

        var activeIds = activeCommittedJobs
            .GroupBy(j => j.EntityType)
            .Select(g => g.First().Id)
            .ToHashSet();

        foreach (var job in jobs)
        {
            job.IsActiveBaseline = activeIds.Contains(job.Id);
        }
    }

    private async Task MarkActiveBaselineAsync(ImportJob job, CancellationToken ct)
    {
        var activeJobId = await db.ImportJobs
            .AsNoTracking()
            .Where(j => j.Status == ImportStatus.Committed && j.EntityType == job.EntityType)
            .OrderByDescending(j => j.CommittedAt)
            .ThenByDescending(j => j.CreatedAt)
            .Select(j => j.Id)
            .FirstOrDefaultAsync(ct);

        job.IsActiveBaseline = activeJobId == job.Id;
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

    private static Dictionary<string, string?> Deserialize(string rawData)
        => string.IsNullOrWhiteSpace(rawData)
            ? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string?>>(rawData)
              ?? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

    private async Task<(Guid JobId, IReadOnlyList<Dictionary<string, string?>> Rows)?> LoadBaselineSnapshotAsync(ImportJob currentJob, CancellationToken ct)
    {
        var latestCommittedJob = await db.ImportJobs.AsNoTracking()
            .Where(j => j.EntityType == currentJob.EntityType
                && j.Status == ImportStatus.Committed
                && j.CommittedAt.HasValue)
            .OrderByDescending(j => j.CommittedAt)
            .ThenByDescending(j => j.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (latestCommittedJob is null)
        {
            return null;
        }

        if (currentJob.Status == ImportStatus.Committed && latestCommittedJob.Id == currentJob.Id)
        {
            var committedRows = await db.StagingRows
                .AsNoTracking()
                .Where(r => r.ImportJobId == currentJob.Id)
                .OrderBy(r => r.RowNumber)
                .ToListAsync(ct);

            return (currentJob.Id, committedRows.Select(row => Deserialize(row.RawData)).ToList());
        }

        var baselineRows = await db.StagingRows
            .AsNoTracking()
            .Where(r => r.ImportJobId == latestCommittedJob.Id)
            .OrderBy(r => r.RowNumber)
            .ToListAsync(ct);

        return (latestCommittedJob.Id, baselineRows.Select(row => Deserialize(row.RawData)).ToList());
    }

    private static Dictionary<string, Dictionary<string, string?>> BuildBaselineLookup(
        EntityType entityType,
        (Guid JobId, IReadOnlyList<Dictionary<string, string?>> Rows)? baselineSnapshot)
    {
        if (baselineSnapshot is null)
        {
            return new Dictionary<string, Dictionary<string, string?>>(StringComparer.OrdinalIgnoreCase);
        }

        var baselineRows = baselineSnapshot.Value.Rows;
        return entityType switch
        {
            EntityType.Article => baselineRows
                .Select(row => (Key: NormalizeJobKey(entityType, row), Row: row))
                .Where(item => !string.IsNullOrWhiteSpace(item.Key))
                .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => NormalizeBaselineRow(entityType, group.First().Row), StringComparer.OrdinalIgnoreCase),
            EntityType.PriceList => baselineRows
                .Select(row => (Key: NormalizeJobKey(entityType, row), Row: row))
                .Where(item => !string.IsNullOrWhiteSpace(item.Key))
                .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => NormalizeBaselineRow(entityType, group.First().Row), StringComparer.OrdinalIgnoreCase),
            EntityType.Description => baselineRows
                .Select(row => (Key: NormalizeJobKey(entityType, row), Row: row))
                .Where(item => !string.IsNullOrWhiteSpace(item.Key))
                .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => NormalizeBaselineRow(entityType, group.First().Row), StringComparer.OrdinalIgnoreCase),
            EntityType.CurrencyRate => baselineRows
                .Select(row => (Key: NormalizeJobKey(entityType, row), Row: row))
                .Where(item => !string.IsNullOrWhiteSpace(item.Key))
                .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => NormalizeBaselineRow(entityType, group.First().Row), StringComparer.OrdinalIgnoreCase),
            _ => new Dictionary<string, Dictionary<string, string?>>(StringComparer.OrdinalIgnoreCase)
        };
    }

    private static Dictionary<string, string?> NormalizeBaselineRow(EntityType entityType, Dictionary<string, string?> row)
    {
        var normalized = new Dictionary<string, string?>(row, StringComparer.OrdinalIgnoreCase);

        if (entityType == EntityType.PriceList && normalized.TryGetValue("Price", out var price))
        {
            normalized["UnitPrice"] = price;
        }

        return normalized;
    }

    private static List<ComparisonFieldChange> BuildChanges(
        IReadOnlyDictionary<string, string?> current,
        IReadOnlyDictionary<string, string?>? baseline)
    {
        var keys = current.Keys
            .Concat(baseline?.Keys ?? Array.Empty<string>())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(k => k, StringComparer.OrdinalIgnoreCase);

        var changes = new List<ComparisonFieldChange>();
        foreach (var key in keys)
        {
            current.TryGetValue(key, out var currentValue);
            var baselineValue = default(string?);
            baseline?.TryGetValue(key, out baselineValue);
            var isDifferent = !ValuesEqual(currentValue, baselineValue);
            changes.Add(new ComparisonFieldChange(key, currentValue, baselineValue, isDifferent));
        }

        return changes;
    }

    private static bool ValuesEqual(string? currentValue, string? baselineValue)
    {
        static string Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
        return string.Equals(Normalize(currentValue), Normalize(baselineValue), StringComparison.OrdinalIgnoreCase);
    }

    private static Dictionary<string, string?> ToDictionary(object row)
    {
        var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (row is IDictionary<string, object?> dict)
        {
            foreach (var pair in dict)
            {
                result[pair.Key] = ConvertValue(pair.Value);
            }
        }

        return result;
    }

    private static string? ConvertValue(object? value)
    {
        if (value is null)
        {
            return null;
        }

        return value switch
        {
            DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            DateTimeOffset dto => dto.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            decimal dec => dec.ToString(CultureInfo.InvariantCulture),
            double dbl => dbl.ToString(CultureInfo.InvariantCulture),
            float fl => fl.ToString(CultureInfo.InvariantCulture),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture)
        };
    }

    private static string NormalizeJobKey(EntityType entityType, IReadOnlyDictionary<string, string?> fields)
    {
        string? Get(string key) => fields.TryGetValue(key, out var value) ? value?.Trim() : null;

        return entityType switch
        {
            EntityType.Article => Get("ArticleNumber") ?? string.Empty,
            EntityType.PriceList => Get("ArticleNumber") ?? string.Empty,
            EntityType.Description => BuildCompositeKey(Get("ArticleNumber"), Get("LanguageCode")),
            EntityType.CurrencyRate => BuildCompositeKey(Get("FromCurrency"), Get("ToCurrency"), Get("ValidFrom")),
            _ => string.Empty
        };
    }

    private static string BuildCompositeKey(params string?[] values)
    {
        if (values.Any(string.IsNullOrWhiteSpace))
        {
            return string.Empty;
        }

        return string.Join("|", values.Select(value => value!.Trim()));
    }

    private sealed record ComparisonRowSource(StagingRow Row, IReadOnlyDictionary<string, string?> Fields, string Key);
}
