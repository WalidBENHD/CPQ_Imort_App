using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Core.Metadata;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Linq.Expressions;

namespace CPQ_Import_App.Infrastructure.Repositories;

public class ImportRepository(AppDbContext db) : IImportRepository
{
    private sealed class JobSummaryRow
    {
        public Guid Id { get; init; }
        public string FileName { get; init; } = string.Empty;
        public string OriginalFileName { get; init; } = string.Empty;
        public EntityType EntityType { get; init; }
        public ImportStatus Status { get; init; }
        public ImportWorkflowStage WorkflowStage { get; init; }
        public DateTime? SubmittedAt { get; init; }
        public string? SubmittedByUserId { get; init; }
        public string? SubmittedByDisplayName { get; init; }
        public DateTime? WithdrawnAt { get; init; }
        public string CreatedBy { get; init; } = string.Empty;
        public string CreatedByDisplayName { get; init; } = string.Empty;
        public DateTime CreatedAt { get; init; }
        public DateTime? ProcessedAt { get; init; }
        public DateTime? CommittedAt { get; init; }
        public string? CommittedBy { get; init; }
        public string? RejectedBy { get; init; }
        public DateTime? RejectedAt { get; init; }
        public string? RejectionReason { get; init; }
        public int TotalRows { get; init; }
        public int ValidRows { get; init; }
        public int WarningRows { get; init; }
        public int ErrorRows { get; init; }
        public int CommittedRows { get; init; }
        public DateTime? ApprovedAt { get; init; }
        public string? ApprovedByUserId { get; init; }
        public string? ApprovedByDisplayName { get; init; }
        public Guid? ValidationAnchorJobId { get; init; }
        public ValidationAnchorKind ValidationAnchorKind { get; init; }
        public DateTime? ValidationAnchorPinnedAt { get; init; }
        public Guid? ReleasePackageId { get; init; }
        public string? ReleasePackageName { get; init; }
    }

    private sealed class ReleasePackageSummaryRow
    {
        public Guid Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public ReleasePackageStatus Status { get; init; }
        public string CreatedBy { get; init; } = string.Empty;
        public string CreatedByDisplayName { get; init; } = string.Empty;
        public DateTime CreatedAt { get; init; }
        public DateTime? SubmittedAt { get; init; }
        public string? SubmittedByDisplayName { get; init; }
        public DateTime? ApprovedAt { get; init; }
        public string? ApprovedByUserId { get; init; }
        public string? ApprovedByDisplayName { get; init; }
        public DateTime? RejectedAt { get; init; }
        public string? RejectedByUserId { get; init; }
        public string? RejectedByDisplayName { get; init; }
        public string? RejectionReason { get; init; }
        public DateTime? PublishedAt { get; init; }
        public string? PublishedByDisplayName { get; init; }
        public string? FailureReason { get; init; }
        public List<ReleaseJobSummaryRow> Jobs { get; init; } = [];
    }

    private sealed class ReleaseJobSummaryRow
    {
        public Guid Id { get; init; }
        public string OriginalFileName { get; init; } = string.Empty;
        public EntityType EntityType { get; init; }
        public ImportStatus Status { get; init; }
        public ImportWorkflowStage WorkflowStage { get; init; }
        public int TotalRows { get; init; }
        public int ErrorRows { get; init; }
        public Guid? ValidationAnchorJobId { get; init; }
        public ValidationAnchorKind ValidationAnchorKind { get; init; }
        public Guid? ReleasePackageId { get; init; }
    }

    private static readonly Expression<Func<ImportJob, JobSummaryRow>> JobSummaryProjection = job => new JobSummaryRow
    {
        Id = job.Id, FileName = job.FileName, OriginalFileName = job.OriginalFileName,
        EntityType = job.EntityType, Status = job.Status, WorkflowStage = job.WorkflowStage,
        SubmittedAt = job.SubmittedAt, SubmittedByUserId = job.SubmittedByUserId,
        SubmittedByDisplayName = job.SubmittedByDisplayName, WithdrawnAt = job.WithdrawnAt,
        CreatedBy = job.CreatedBy, CreatedByDisplayName = job.CreatedByDisplayName,
        CreatedAt = job.CreatedAt, ProcessedAt = job.ProcessedAt, CommittedAt = job.CommittedAt,
        CommittedBy = job.CommittedBy, RejectedBy = job.RejectedBy, RejectedAt = job.RejectedAt,
        RejectionReason = job.RejectionReason, TotalRows = job.TotalRows, ValidRows = job.ValidRows,
        WarningRows = job.WarningRows, ErrorRows = job.ErrorRows, CommittedRows = job.CommittedRows,
        ApprovedAt = job.ApprovedAt, ApprovedByUserId = job.ApprovedByUserId,
        ApprovedByDisplayName = job.ApprovedByDisplayName, ValidationAnchorJobId = job.ValidationAnchorJobId,
        ValidationAnchorKind = job.ValidationAnchorKind, ValidationAnchorPinnedAt = job.ValidationAnchorPinnedAt,
        ReleasePackageId = job.ReleasePackageId,
        ReleasePackageName = job.ReleasePackage == null ? null : job.ReleasePackage.Name
    };

    private static ImportJob ToJobSummary(JobSummaryRow row) => new()
    {
        Id = row.Id, FileName = row.FileName, OriginalFileName = row.OriginalFileName,
        EntityType = row.EntityType, Status = row.Status, WorkflowStage = row.WorkflowStage,
        SubmittedAt = row.SubmittedAt, SubmittedByUserId = row.SubmittedByUserId,
        SubmittedByDisplayName = row.SubmittedByDisplayName, WithdrawnAt = row.WithdrawnAt,
        CreatedBy = row.CreatedBy, CreatedByDisplayName = row.CreatedByDisplayName,
        CreatedAt = row.CreatedAt, ProcessedAt = row.ProcessedAt, CommittedAt = row.CommittedAt,
        CommittedBy = row.CommittedBy, RejectedBy = row.RejectedBy, RejectedAt = row.RejectedAt,
        RejectionReason = row.RejectionReason, TotalRows = row.TotalRows, ValidRows = row.ValidRows,
        WarningRows = row.WarningRows, ErrorRows = row.ErrorRows, CommittedRows = row.CommittedRows,
        ApprovedAt = row.ApprovedAt, ApprovedByUserId = row.ApprovedByUserId,
        ApprovedByDisplayName = row.ApprovedByDisplayName, ValidationAnchorJobId = row.ValidationAnchorJobId,
        ValidationAnchorKind = row.ValidationAnchorKind, ValidationAnchorPinnedAt = row.ValidationAnchorPinnedAt,
        ReleasePackageId = row.ReleasePackageId,
        ReleasePackage = row.ReleasePackageId.HasValue ? new ReleasePackage
        {
            Id = row.ReleasePackageId.Value,
            Name = row.ReleasePackageName ?? string.Empty
        } : null
    };

    public async Task<ImportJob> CreateJobAsync(ImportJob job, CancellationToken ct = default)
    {
        db.ImportJobs.Add(job);
        await db.SaveChangesAsync(ct);
        return job;
    }

    public async Task<ImportJob> CreateCopiedJobAsync(
        ImportJob job,
        IReadOnlyCollection<StagingRow> rows,
        string uploadedFileName,
        byte[] uploadedFileContent,
        AuditLog auditLog,
        CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.ImportJobs.Add(job);
        await db.StagingRows.AddRangeAsync(rows, ct);
        db.UploadedFiles.Add(new UploadedFile
        {
            JobId = job.Id,
            FileName = uploadedFileName,
            Content = uploadedFileContent
        });
        db.AuditLogs.Add(auditLog);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return job;
    }

    public async Task<ImportJob?> GetJobAsync(Guid id, CancellationToken ct = default)
    {
        var job = await db.ImportJobs
            .Include(j => j.AuditLogs)
            .Include(j => j.ReleasePackage)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (job is not null)
        {
            await MarkActiveBaselineAsync(job, ct);
            await PopulateDraftCountsAsync([job], ct);
        }

        return job;
    }

    public async Task<ImportJob?> GetJobSummaryAsync(Guid id, CancellationToken ct = default)
    {
        var row = await db.ImportJobs.AsNoTracking()
            .Where(item => item.Id == id)
            .Select(JobSummaryProjection)
            .FirstOrDefaultAsync(ct);
        var job = row is null ? null : ToJobSummary(row);
        if (job is not null)
        {
            await MarkActiveBaselineAsync(job, ct);
            await PopulateDraftCountsAsync([job], ct);
        }
        return job;
    }

    public async Task<bool> IsUploadNameInUseAsync(
        string fileName,
        Guid? excludingJobId = null,
        CancellationToken ct = default)
    {
        var names = await db.ImportJobs.AsNoTracking()
            .Where(job => !excludingJobId.HasValue || job.Id != excludingJobId.Value)
            .Select(job => job.OriginalFileName)
            .ToListAsync(ct);
        var visibleName = Path.GetFileNameWithoutExtension(fileName).Trim();
        return names.Any(existing => string.Equals(
            Path.GetFileNameWithoutExtension(existing).Trim(),
            visibleName,
            StringComparison.OrdinalIgnoreCase));
    }

    public Task<bool> IsReleaseNameInUseAsync(
        string name,
        Guid? excludingPackageId = null,
        CancellationToken ct = default)
    {
        var normalizedName = name.Trim().ToLower();
        return db.ReleasePackages.AsNoTracking().AnyAsync(package =>
            (!excludingPackageId.HasValue || package.Id != excludingPackageId.Value)
            && package.Name.ToLower() == normalizedName, ct);
    }

    public async Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, string viewerUserId, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default)
    {
        IQueryable<ImportJob> query = db.ImportJobs
            .AsNoTracking()
            .Where(j => j.WorkflowStage != ImportWorkflowStage.Private || j.CreatedBy == viewerUserId)
            .OrderByDescending(j => j.CreatedAt);

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
        var rows = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(JobSummaryProjection)
            .ToListAsync(ct);
        var items = rows.Select(ToJobSummary).ToList();

        await MarkActiveBaselinesAsync(items, ct);
        await PopulateDraftCountsAsync(items, ct);

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
            .Where(r => r.ImportJobId == jobId && !r.IsDeleted)
            .OrderBy(r => r.RowNumber)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<StagingRow>> GetDeletedStagingRowsByJobAsync(Guid jobId, CancellationToken ct = default)
        => await db.StagingRows
            .AsNoTracking()
            .Where(r => r.ImportJobId == jobId && r.IsDeleted)
            .OrderByDescending(r => r.DeletedAt)
            .ThenBy(r => r.RowNumber)
            .ToListAsync(ct);

    public async Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsPagedAsync(
        Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null, ComparisonStatus? comparisonStatus = null, CancellationToken ct = default)
    {
        var query = db.StagingRows.AsNoTracking().Where(r => r.ImportJobId == jobId && !r.IsDeleted);
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
            .Where(r => r.ImportJobId == jobId && !r.IsDeleted)
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
            .Where(r => r.ImportJobId == articleJob.Id && !r.IsDeleted)
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

    public async Task<IReadOnlySet<string>> GetArticleNumbersForJobAsync(Guid articleJobId, CancellationToken ct = default)
    {
        var isArticleJob = await db.ImportJobs.AsNoTracking()
            .AnyAsync(job => job.Id == articleJobId && job.EntityType == EntityType.Article, ct);
        if (!isArticleJob)
        {
            throw new KeyNotFoundException($"Article Master upload '{articleJobId}' was not found.");
        }

        var rows = await db.StagingRows.AsNoTracking()
            .Where(row => row.ImportJobId == articleJobId && !row.IsDeleted)
            .Select(row => row.RawData)
            .ToListAsync(ct);

        return rows.Select(Deserialize)
            .Select(fields => fields.TryGetValue("ArticleNumber", out var value) ? value?.Trim() : null)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task<ImportJob?> GetLatestCommittedJobAsync(EntityType entityType, CancellationToken ct = default)
    {
        var row = await db.ImportJobs.AsNoTracking()
            .Where(job => job.EntityType == entityType && job.Status == ImportStatus.Committed)
            .OrderByDescending(job => job.CommittedAt)
            .ThenByDescending(job => job.CreatedAt)
            .Select(JobSummaryProjection)
            .FirstOrDefaultAsync(ct);
        return row is null ? null : ToJobSummary(row);
    }

    public async Task<IReadOnlyList<ImportJob>> GetOwnedPrivateJobsAsync(
        string userId,
        EntityType? entityType = null,
        CancellationToken ct = default)
    {
        var query = db.ImportJobs.AsNoTracking()
            .Where(job => job.CreatedBy == userId && job.WorkflowStage == ImportWorkflowStage.Private);
        if (entityType.HasValue)
        {
            query = query.Where(job => job.EntityType == entityType.Value);
        }

        return (await query.OrderByDescending(job => job.CreatedAt)
            .Select(JobSummaryProjection)
            .ToListAsync(ct)).Select(ToJobSummary).ToList();
    }

    public async Task<IReadOnlyList<ImportJob>> GetArticleMasterCandidatesAsync(
        string userId,
        CancellationToken ct = default)
        => (await db.ImportJobs.AsNoTracking()
            .Where(job => job.EntityType == EntityType.Article
                && ((job.WorkflowStage == ImportWorkflowStage.Private && job.CreatedBy == userId)
                    || job.WorkflowStage == ImportWorkflowStage.Submitted
                    || job.WorkflowStage == ImportWorkflowStage.Approved
                    || job.WorkflowStage == ImportWorkflowStage.Published))
            .OrderByDescending(job => job.WorkflowStage == ImportWorkflowStage.Published)
            .ThenByDescending(job => job.CommittedAt)
            .ThenByDescending(job => job.CreatedAt)
            .Select(JobSummaryProjection)
            .ToListAsync(ct)).Select(ToJobSummary).ToList();

    public async Task<IReadOnlyList<ImportJob>> GetPriceListCandidatesAsync(
        string userId,
        CancellationToken ct = default)
        => (await db.ImportJobs.AsNoTracking()
            .Where(job => job.EntityType == EntityType.PriceList
                && ((job.WorkflowStage == ImportWorkflowStage.Private && job.CreatedBy == userId)
                    || job.WorkflowStage == ImportWorkflowStage.Submitted
                    || job.WorkflowStage == ImportWorkflowStage.Approved
                    || job.WorkflowStage == ImportWorkflowStage.Published))
            .OrderByDescending(job => job.WorkflowStage == ImportWorkflowStage.Published)
            .ThenByDescending(job => job.CommittedAt)
            .ThenByDescending(job => job.CreatedAt)
            .Select(JobSummaryProjection)
            .ToListAsync(ct)).Select(ToJobSummary).ToList();

    public Task<ReleasePackage?> GetReleasePackageAsync(Guid packageId, CancellationToken ct = default)
        => db.ReleasePackages.Include(package => package.Jobs)
            .FirstOrDefaultAsync(package => package.Id == packageId, ct);

    public async Task<ReleasePackage?> GetReleasePackageSummaryAsync(
        Guid packageId,
        CancellationToken ct = default)
    {
        var row = await db.ReleasePackages.AsNoTracking()
            .Where(package => package.Id == packageId)
            .Select(package => new ReleasePackageSummaryRow
            {
                Id = package.Id,
                Name = package.Name,
                Status = package.Status,
                CreatedBy = package.CreatedBy,
                CreatedByDisplayName = package.CreatedByDisplayName,
                CreatedAt = package.CreatedAt,
                SubmittedAt = package.SubmittedAt,
                SubmittedByDisplayName = package.SubmittedByDisplayName,
                ApprovedAt = package.ApprovedAt,
                ApprovedByUserId = package.ApprovedByUserId,
                ApprovedByDisplayName = package.ApprovedByDisplayName,
                RejectedAt = package.RejectedAt,
                RejectedByUserId = package.RejectedByUserId,
                RejectedByDisplayName = package.RejectedByDisplayName,
                RejectionReason = package.RejectionReason,
                PublishedAt = package.PublishedAt,
                PublishedByDisplayName = package.PublishedByDisplayName,
                FailureReason = package.FailureReason,
                Jobs = package.Jobs.Select(job => new ReleaseJobSummaryRow
                {
                    Id = job.Id,
                    OriginalFileName = job.OriginalFileName,
                    EntityType = job.EntityType,
                    Status = job.Status,
                    WorkflowStage = job.WorkflowStage,
                    TotalRows = job.TotalRows,
                    ErrorRows = job.ErrorRows,
                    ValidationAnchorJobId = job.ValidationAnchorJobId,
                    ValidationAnchorKind = job.ValidationAnchorKind,
                    ReleasePackageId = job.ReleasePackageId
                }).ToList()
            })
            .FirstOrDefaultAsync(ct);

        return row is null ? null : new ReleasePackage
        {
            Id = row.Id,
            Name = row.Name,
            Status = row.Status,
            CreatedBy = row.CreatedBy,
            CreatedByDisplayName = row.CreatedByDisplayName,
            CreatedAt = row.CreatedAt,
            SubmittedAt = row.SubmittedAt,
            SubmittedByDisplayName = row.SubmittedByDisplayName,
            ApprovedAt = row.ApprovedAt,
            ApprovedByUserId = row.ApprovedByUserId,
            ApprovedByDisplayName = row.ApprovedByDisplayName,
            RejectedAt = row.RejectedAt,
            RejectedByUserId = row.RejectedByUserId,
            RejectedByDisplayName = row.RejectedByDisplayName,
            RejectionReason = row.RejectionReason,
            PublishedAt = row.PublishedAt,
            PublishedByDisplayName = row.PublishedByDisplayName,
            FailureReason = row.FailureReason,
            Jobs = row.Jobs.Select(job => new ImportJob
            {
                Id = job.Id,
                OriginalFileName = job.OriginalFileName,
                EntityType = job.EntityType,
                Status = job.Status,
                WorkflowStage = job.WorkflowStage,
                TotalRows = job.TotalRows,
                ErrorRows = job.ErrorRows,
                ValidationAnchorJobId = job.ValidationAnchorJobId,
                ValidationAnchorKind = job.ValidationAnchorKind,
                ReleasePackageId = job.ReleasePackageId
            }).ToList()
        };
    }

    public async Task AddReleasePackageAsync(ReleasePackage package, CancellationToken ct = default)
    {
        db.ReleasePackages.Add(package);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteReleasePackageAsync(ReleasePackage package, CancellationToken ct = default)
    {
        db.ReleasePackages.Remove(package);
        await db.SaveChangesAsync(ct);
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
            .Select(j => new { j.Id, j.EntityType })
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
                .Where(r => r.ImportJobId == currentJob.Id && !r.IsDeleted)
                .OrderBy(r => r.RowNumber)
                .ToListAsync(ct);

            return (currentJob.Id, committedRows.Select(row => Deserialize(row.RawData)).ToList());
        }

        var baselineRows = await db.StagingRows
            .AsNoTracking()
            .Where(r => r.ImportJobId == latestCommittedJob.Id && !r.IsDeleted)
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

    private async Task PopulateDraftCountsAsync(IReadOnlyCollection<ImportJob> jobs, CancellationToken ct)
    {
        if (jobs.Count == 0)
        {
            return;
        }

        var jobIds = jobs.Select(job => job.Id).ToList();
        var counts = await db.StagingRows
            .AsNoTracking()
            .Where(row => jobIds.Contains(row.ImportJobId))
            .GroupBy(row => row.ImportJobId)
            .Select(group => new
            {
                JobId = group.Key,
                Added = group.Count(row => row.IsUserAdded && !row.IsDeleted),
                Modified = group.Count(row => row.IsUserModified && !row.IsDeleted),
                Removed = group.Count(row => row.IsDeleted)
            })
            .ToDictionaryAsync(item => item.JobId, ct);

        foreach (var job in jobs)
        {
            if (!counts.TryGetValue(job.Id, out var count))
            {
                continue;
            }

            job.DraftAddedRows = count.Added;
            job.DraftModifiedRows = count.Modified;
            job.DraftRemovedRows = count.Removed;
        }
    }

    public async Task DeleteJobAsync(ImportJob job, CancellationToken ct = default)
    {
        var uploadedFile = await db.UploadedFiles.FindAsync([job.Id], ct);
        if (uploadedFile is not null)
            db.UploadedFiles.Remove(uploadedFile);
        db.ImportJobs.Remove(job);
        await db.SaveChangesAsync(ct);
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
