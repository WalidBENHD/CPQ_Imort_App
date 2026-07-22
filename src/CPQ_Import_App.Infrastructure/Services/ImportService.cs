using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Parsers;
using CPQ_Import_App.Infrastructure.Templates;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System.Drawing;
using System.Globalization;
using System.Text;
using CsvHelper;

namespace CPQ_Import_App.Infrastructure.Services;

public class ImportService(
    IImportRepository repository,
    IEnumerable<IFileParser> parsers,
    IEnumerable<ICpqCommitStrategy> commitStrategies) : IImportService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = false,
        PropertyNameCaseInsensitive = true
    };

    public async Task<MaintenanceDraft> CreateMaintenanceDraftAsync(
        EntityType entityType,
        string name,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        if (!DatasetCatalog.IsSupported(entityType))
            throw new InvalidDataException($"Dataset '{entityType}' is not supported.");

        var draftName = name.Trim();
        if (draftName.Length is 0 or > 140)
            throw new InvalidDataException("Provide a maintenance draft name of at most 140 characters.");

        if (entityType is EntityType.Article or EntityType.PriceList)
        {
            var releaseName = draftName;
            if (await repository.IsReleaseNameInUseAsync(releaseName, ct: ct))
                throw new InvalidDataException($"A release named '{releaseName}' already exists. Choose another name.");

            var articleName = $"{draftName} - Article Master";
            var priceName = $"{draftName} - Basis Price";
            foreach (var candidateName in new[] { articleName, priceName })
            {
                if (await repository.IsUploadNameInUseAsync($"{candidateName}.hmi", ct: ct))
                    throw new InvalidDataException($"A draft named '{candidateName}' already exists. Choose another name.");
            }

            var articleJob = await CreateMaintenanceSnapshotAsync(EntityType.Article, articleName, userId, userDisplayName, ct);
            var priceJob = await CreateMaintenanceSnapshotAsync(EntityType.PriceList, priceName, userId, userDisplayName, ct);
            var package = new ReleasePackage
            {
                Name = releaseName,
                CreatedBy = userId,
                CreatedByDisplayName = userDisplayName
            };
            await repository.AddReleasePackageAsync(package, ct);

            articleJob.ReleasePackageId = package.Id;
            priceJob.ReleasePackageId = package.Id;
            priceJob.ValidationAnchorJobId = articleJob.Id;
            priceJob.ValidationAnchorKind = ValidationAnchorKind.ReleaseCandidate;
            priceJob.ValidationAnchorPinnedAt = DateTime.UtcNow;
            await repository.UpdateJobAsync(articleJob, ct);
            await RevalidateArticlePriceCoverageAsync(articleJob, priceJob.Id, ct);
            await RevalidateAgainstAnchorAsync(priceJob, articleJob.Id, ct);

            foreach (var job in new[] { articleJob, priceJob })
            {
                await repository.AddAuditLogAsync(new AuditLog
                {
                    ImportJobId = job.Id,
                    Action = "MaintenanceReleaseCreated",
                    PerformedBy = userId,
                    PerformedByDisplayName = userDisplayName,
                    Details = $"Created HMI maintenance candidate in coordinated release '{releaseName}' ({package.Id:D})."
                }, ct);
            }

            var summary = await repository.GetReleasePackageSummaryAsync(package.Id, ct)
                ?? throw new InvalidOperationException("The maintenance release could not be loaded after creation.");
            return new MaintenanceDraft([articleJob, priceJob], ToReleaseSummary(summary));
        }

        var standalone = await CreateMaintenanceSnapshotAsync(entityType, draftName, userId, userDisplayName, ct);
        return new MaintenanceDraft([standalone], null);
    }

    private async Task<ImportJob> CreateMaintenanceSnapshotAsync(
        EntityType entityType,
        string name,
        string userId,
        string userDisplayName,
        CancellationToken ct)
    {
        var visibleName = $"{name}.hmi";
        if (await repository.IsUploadNameInUseAsync(visibleName, ct: ct))
            throw new InvalidDataException($"A draft named '{name}' already exists. Choose another name.");

        var baseline = await repository.GetLatestCommittedJobAsync(entityType, ct);
        var sourceRows = baseline is null
            ? []
            : await repository.GetStagingRowsByJobAsync(baseline.Id, ct);
        var now = DateTime.UtcNow;
        var job = new ImportJob
        {
            FileName = $"{Guid.NewGuid()}.hmi",
            OriginalFileName = visibleName,
            EntityType = entityType,
            Status = ImportStatus.AwaitingApproval,
            WorkflowStage = ImportWorkflowStage.Private,
            CreatedBy = userId,
            CreatedByDisplayName = userDisplayName,
            CreatedAt = now,
            ProcessedAt = now,
            TotalRows = sourceRows.Count,
            ValidRows = sourceRows.Count(row => row.Status == RowStatus.Valid),
            WarningRows = sourceRows.Count(row => row.Status == RowStatus.Warning),
            ErrorRows = sourceRows.Count(row => row.Status == RowStatus.Error)
        };

        if (IsDependentDataset(entityType))
        {
            var activeMaster = await repository.GetLatestCommittedJobAsync(EntityType.Article, ct);
            if (activeMaster is not null)
            {
                job.ValidationAnchorJobId = activeMaster.Id;
                job.ValidationAnchorKind = ValidationAnchorKind.ActiveBaseline;
                job.ValidationAnchorPinnedAt = now;
            }
        }

        var rows = sourceRows.Select(row => new StagingRow
        {
            ImportJobId = job.Id,
            RowNumber = row.RowNumber,
            Status = row.Status,
            RawData = row.RawData,
            ValidationMessages = row.ValidationMessages,
            IsSelected = row.IsSelected
        }).ToList();
        return await repository.CreateDraftSnapshotAsync(job, rows, new AuditLog
        {
            ImportJobId = job.Id,
            Action = "MaintenanceDraftCreated",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = baseline is null
                ? "Created an empty HMI maintenance candidate because no published baseline exists."
                : $"Created an HMI maintenance candidate from published baseline '{baseline.OriginalFileName}' ({baseline.Id:D}) with {rows.Count} active rows."
        }, ct);
    }

    public async Task<ImportJob> UploadAsync(Stream fileStream, string fileName, EntityType entityType,
        string userId, string userDisplayName, CancellationToken ct = default)
    {
        if (await repository.IsUploadNameInUseAsync(fileName, ct: ct))
            throw new InvalidDataException($"An upload named '{Path.GetFileNameWithoutExtension(fileName)}' already exists. Choose another name.");

        // Read file bytes for storage
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        var fileBytes = ms.ToArray();
        ms.Position = 0;

        var job = new ImportJob
        {
            FileName = $"{Guid.NewGuid()}{Path.GetExtension(fileName)}",
            OriginalFileName = fileName,
            EntityType = entityType,
            Status = ImportStatus.Processing,
            WorkflowStage = ImportWorkflowStage.Private,
            CreatedBy = userId,
            CreatedByDisplayName = userDisplayName
        };

        await repository.CreateJobAsync(job, ct);
        await repository.SaveUploadedFileAsync(job.Id, fileName, fileBytes, ct);

        if (IsDependentDataset(entityType))
        {
            var activeMaster = await repository.GetLatestCommittedJobAsync(EntityType.Article, ct);
            if (activeMaster is not null)
            {
                job.ValidationAnchorJobId = activeMaster.Id;
                job.ValidationAnchorKind = ValidationAnchorKind.ActiveBaseline;
                job.ValidationAnchorPinnedAt = DateTime.UtcNow;
            }
        }

        // Find parser
        var parser = parsers.FirstOrDefault(p => p.CanParse(fileName, entityType))
            ?? throw new InvalidOperationException($"No parser found for dataset '{DatasetCatalog.Get(entityType).DisplayName}'.");

        List<StagingRow> stagingRows;
        try
        {
            ms.Position = 0;
            var parsed = await parser.ParseAsync(ms, fileName, ct);
            IReadOnlySet<string>? approvedArticles = job.ValidationAnchorJobId.HasValue
                ? await repository.GetArticleNumbersForJobAsync(job.ValidationAnchorJobId.Value, ct)
                : null;
            IReadOnlySet<string>? activePriceArticles = entityType == EntityType.Article
                ? await GetActivePriceArticleNumbersAsync(ct)
                : null;

        foreach (var row in parsed)
        {
            await ApplyCurrentBaselineValidationAsync(entityType, row.Fields, row.Messages, approvedArticles, activePriceArticles, ct);
        }

        if (entityType is EntityType.Article or EntityType.PriceList)
            ApplyDuplicateArticleValidation(parsed);

        stagingRows = parsed.Select(r =>
        {
            var status = RowValidator.DeriveStatus(r.Messages);
            return new StagingRow
                {
                    ImportJobId = job.Id,
                    RowNumber = r.RowNumber,
                    Status = status,
                    RawData = JsonSerializer.Serialize(r.Fields, JsonOpts),
                    ValidationMessages = r.Messages.Count > 0
                        ? JsonSerializer.Serialize(r.Messages, JsonOpts)
                        : null
                };
            }).ToList();
        }
        catch (Exception ex)
        {
            job.Status = ImportStatus.Failed;
            job.ProcessedAt = DateTime.UtcNow;
            await repository.UpdateJobAsync(job, ct);
            await repository.AddAuditLogAsync(new AuditLog
            {
                ImportJobId = job.Id,
                Action = "Failed",
                PerformedBy = userId,
                PerformedByDisplayName = userDisplayName,
                Details = ex.Message
            }, ct);
            throw;
        }

        if (stagingRows.Count > 0)
            await repository.AddStagingRowsAsync(stagingRows, ct);

        job.TotalRows = stagingRows.Count;
        job.ValidRows = stagingRows.Count(r => r.Status == RowStatus.Valid);
        job.WarningRows = stagingRows.Count(r => r.Status == RowStatus.Warning);
        job.ErrorRows = stagingRows.Count(r => r.Status == RowStatus.Error);
        job.Status = job.ErrorRows > 0 ? ImportStatus.NeedsCorrection : ImportStatus.AwaitingApproval;
        job.ProcessedAt = DateTime.UtcNow;

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Uploaded",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = job.Status == ImportStatus.NeedsCorrection
                ? $"Parsed {job.TotalRows} rows. Valid: {job.ValidRows}, Warnings: {job.WarningRows}, Errors: {job.ErrorRows}. User correction required."
                : $"Parsed {job.TotalRows} rows. Valid: {job.ValidRows}, Warnings: {job.WarningRows}, Errors: {job.ErrorRows}."
        }, ct);

        return job;
    }

    public Task<ImportJob?> GetJobAsync(Guid jobId, CancellationToken ct = default)
        => repository.GetJobSummaryAsync(jobId, ct);

    public Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, string viewerUserId, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default)
        => repository.GetJobsPagedAsync(page, pageSize, viewerUserId, search, status, entityType, ct);

    public async Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsAsync(
        Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null, ComparisonStatus? comparisonStatus = null, CancellationToken ct = default)
    {
        var job = await repository.GetJobSummaryAsync(jobId, ct);
        if (job is not null
            && job.EntityType == EntityType.Article
            && job.WorkflowStage == ImportWorkflowStage.Private
            && job.Status is not (ImportStatus.Processing or ImportStatus.Failed or ImportStatus.Cancelled))
        {
            await RefreshArticlePriceCoverageAsync(job, ct);
        }

        return await repository.GetStagingRowsPagedAsync(jobId, page, pageSize, search, filterStatus, comparisonStatus, ct);
    }

    public async Task<ImportJob> RefreshValidationAsync(
        Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        EnsurePrivateOwner(job, userId, "refresh");

        if (job.Status is ImportStatus.Approved or ImportStatus.Committed or ImportStatus.Rejected or ImportStatus.Failed or ImportStatus.Cancelled)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be refreshed.");

        var parser = parsers.FirstOrDefault(p => p.SupportedEntityType == job.EntityType)
            ?? throw new InvalidOperationException($"No parser found for dataset '{DatasetCatalog.Get(job.EntityType).DisplayName}'.");

        var rows = await repository.GetStagingRowsByJobAsync(jobId, ct);
        IReadOnlySet<string>? approvedArticles = null;
        if (IsDependentDataset(job.EntityType) && job.ValidationAnchorJobId.HasValue)
            approvedArticles = await repository.GetArticleNumbersForJobAsync(job.ValidationAnchorJobId.Value, ct);
        var activePriceArticles = job.EntityType == EntityType.Article
            ? await GetArticlePriceContextAsync(job, ct)
            : null;

        foreach (var row in rows)
        {
            var fields = DeserializeFields(row.RawData);
            var messages = parser.ValidateRow(fields);
            await ApplyCurrentBaselineValidationAsync(job.EntityType, fields, messages, approvedArticles, activePriceArticles, ct);

            row.RawData = JsonSerializer.Serialize(fields, JsonOpts);
            row.ValidationMessages = messages.Count > 0
                ? JsonSerializer.Serialize(messages, JsonOpts)
                : null;
            row.Status = RowValidator.DeriveStatus(messages);
        }

        if (job.EntityType is EntityType.Article or EntityType.PriceList)
            ApplyDuplicateArticleValidation(rows);

        ApplyJobTotals(job, rows);
        await repository.SaveChangesAsync(ct);

        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Refreshed",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = "Validation refreshed against the latest approved master data."
        }, ct);

        return job;
    }

    public async Task<StagingRow> UpdateStagingRowAsync(
        Guid jobId, Guid rowId, Dictionary<string, string?> fields, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        EnsurePrivateOwner(job, userId, "edit");

        if (job.Status is ImportStatus.Approved or ImportStatus.Committed or ImportStatus.Rejected or ImportStatus.Failed or ImportStatus.Cancelled)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be edited.");

        var row = await repository.GetStagingRowAsync(jobId, rowId, ct)
            ?? throw new KeyNotFoundException($"Row '{rowId}' not found for import job '{jobId}'.");
        if (row.IsDeleted)
            throw new InvalidOperationException("Restore this row before editing it.");

        var parser = parsers.FirstOrDefault(p => p.SupportedEntityType == job.EntityType)
            ?? throw new InvalidOperationException($"No parser found for dataset '{DatasetCatalog.Get(job.EntityType).DisplayName}'.");

        var messages = parser.ValidateRow(fields);
        var approvedArticles = await GetAnchoredArticleNumbersAsync(job, ct);
        var activePriceArticles = job.EntityType == EntityType.Article
            ? await GetArticlePriceContextAsync(job, ct)
            : null;
        await ApplyCurrentBaselineValidationAsync(job.EntityType, fields, messages, approvedArticles, activePriceArticles, ct);
        row.RawData = JsonSerializer.Serialize(fields, JsonOpts);
        row.ValidationMessages = messages.Count > 0 ? JsonSerializer.Serialize(messages, JsonOpts) : null;
        row.Status = RowValidator.DeriveStatus(messages);
        if (!row.IsUserAdded)
            row.IsUserModified = true;

        await repository.UpdateStagingRowAsync(row, ct);

        await RevalidateDuplicateArticleRowsAsync(jobId, ct);

        await RecalculateJobAsync(job, ct);

        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Corrected",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Row {row.RowNumber} updated and revalidated. Status: {row.Status}."
        }, ct);

        return row;
    }

    public async Task<ImportJob> AddStagingRowAsync(
        Guid jobId, Dictionary<string, string?> fields, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await GetEditablePrivateJobAsync(jobId, userId, "add rows to", ct);
        var parser = GetParser(job.EntityType);
        var messages = parser.ValidateRow(fields);
        var approvedArticles = await GetAnchoredArticleNumbersAsync(job, ct);
        var activePriceArticles = job.EntityType == EntityType.Article
            ? await GetArticlePriceContextAsync(job, ct)
            : null;
        await ApplyCurrentBaselineValidationAsync(job.EntityType, fields, messages, approvedArticles, activePriceArticles, ct);

        var activeRows = await repository.GetStagingRowsByJobAsync(jobId, ct);
        var deletedRows = await repository.GetDeletedStagingRowsByJobAsync(jobId, ct);
        var row = new StagingRow
        {
            ImportJobId = jobId,
            RowNumber = activeRows.Concat(deletedRows).Select(item => item.RowNumber).DefaultIfEmpty(1).Max() + 1,
            RawData = JsonSerializer.Serialize(fields, JsonOpts),
            ValidationMessages = messages.Count > 0 ? JsonSerializer.Serialize(messages, JsonOpts) : null,
            Status = RowValidator.DeriveStatus(messages),
            IsUserAdded = true
        };

        await repository.AddStagingRowsAsync([row], ct);
        await RevalidateDuplicateArticleRowsAsync(jobId, ct);
        await RecalculateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "DraftRowAdded",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Row {row.RowNumber} was created in the private draft and validated as {row.Status}."
        }, ct);

        return (await repository.GetJobAsync(jobId, ct))!;
    }

    public async Task<ImportJob> DeleteStagingRowsAsync(
        Guid jobId, IReadOnlyCollection<Guid> rowIds, string userId, string userDisplayName, CancellationToken ct = default)
    {
        if (rowIds.Count == 0)
            throw new InvalidDataException("Select at least one row to delete.");

        var job = await GetEditablePrivateJobAsync(jobId, userId, "delete rows from", ct);
        var rows = await LoadRequestedRowsAsync(jobId, rowIds, ct);
        var now = DateTime.UtcNow;
        foreach (var row in rows.Where(row => !row.IsDeleted))
        {
            row.IsDeleted = true;
            row.DeletedAt = now;
            row.DeletedByUserId = userId;
            row.DeletedByDisplayName = userDisplayName;
        }

        await repository.SaveChangesAsync(ct);
        await RevalidateDuplicateArticleRowsAsync(jobId, ct);
        await RecalculateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "DraftRowsDeleted",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Removed {rows.Count} row(s) from the private working draft: {string.Join(", ", rows.Select(row => row.RowNumber))}."
        }, ct);

        return (await repository.GetJobAsync(jobId, ct))!;
    }

    public async Task<ImportJob> RestoreStagingRowsAsync(
        Guid jobId, IReadOnlyCollection<Guid> rowIds, string userId, string userDisplayName, CancellationToken ct = default)
    {
        if (rowIds.Count == 0)
            throw new InvalidDataException("Select at least one row to restore.");

        var job = await GetEditablePrivateJobAsync(jobId, userId, "restore rows in", ct);
        var rows = await LoadRequestedRowsAsync(jobId, rowIds, ct);
        foreach (var row in rows.Where(row => row.IsDeleted))
        {
            row.IsDeleted = false;
            row.DeletedAt = null;
            row.DeletedByUserId = null;
            row.DeletedByDisplayName = null;
        }

        await repository.SaveChangesAsync(ct);
        await RevalidateDuplicateArticleRowsAsync(jobId, ct);
        await RecalculateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "DraftRowsRestored",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Restored {rows.Count} row(s) to the private working draft: {string.Join(", ", rows.Select(row => row.RowNumber))}."
        }, ct);

        return (await repository.GetJobAsync(jobId, ct))!;
    }

    public Task<IReadOnlyList<StagingRow>> GetDeletedStagingRowsAsync(Guid jobId, CancellationToken ct = default)
        => repository.GetDeletedStagingRowsByJobAsync(jobId, ct);

    public async Task<ImportJob> SubmitForReviewAsync(
        Guid jobId, string userId, string userDisplayName, CancellationToken ct = default, bool coordinatedRelease = false)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        EnsurePrivateOwner(job, userId, "submit");
        if (job.ReleasePackageId.HasValue && !coordinatedRelease)
            throw new InvalidOperationException("This upload belongs to a coordinated release and must be submitted from the release package.");
        if (job.Status != ImportStatus.AwaitingApproval || job.ErrorRows > 0)
            throw new InvalidOperationException("Blocking errors must be corrected before this upload can be submitted.");
        if (job.TotalRows == 0)
            throw new InvalidOperationException("A draft with no active rows cannot be submitted for review.");
        if (!coordinatedRelease && job.EntityType is EntityType.Article or EntityType.PriceList)
            await EnsurePortfolioIsConsistentAsync(await BuildIndividualPortfolioReadinessAsync(job, ct), "submitted independently");

        var comparison = await repository.GetComparisonAsync(jobId, ct);
        job.WorkflowStage = ImportWorkflowStage.Submitted;
        job.SubmittedAt = DateTime.UtcNow;
        job.SubmittedByUserId = userId;
        job.SubmittedByDisplayName = userDisplayName;
        job.SubmittedComparisonJson = JsonSerializer.Serialize(comparison, JsonOpts);
        job.WithdrawnAt = null;

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Submitted",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Submitted for review: {comparison.NewRows} new, {comparison.ModifiedRows} modified, and {comparison.MissingBaselineRows} scoped deletions."
        }, ct);

        return job;
    }

    public async Task<DependencyContext> GetDependencyContextAsync(
        Guid jobId, string userId, CancellationToken ct = default)
    {
        var job = await repository.GetJobSummaryAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");
        if (!string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase)
            && job.WorkflowStage == ImportWorkflowStage.Private)
            throw new UnauthorizedAccessException("This private validation context belongs to another user.");

        if (!IsDependentDataset(job.EntityType))
        {
            var linkedPackage = job.ReleasePackageId.HasValue
                ? await repository.GetReleasePackageSummaryAsync(job.ReleasePackageId.Value, ct)
                : null;
            var readiness = linkedPackage is null || job.EntityType != EntityType.Article
                ? null
                : await BuildPackagePortfolioReadinessAsync(linkedPackage, ct);
            return new DependencyContext(job.Id, false, ValidationAnchorKind.None, null, null, null, false,
                new DependencyImpact(job.TotalRows, job.TotalRows, 0, 0, []), null,
                linkedPackage is null ? null : ToReleaseSummary(linkedPackage), readiness, []);
        }

        var latest = await repository.GetLatestCommittedJobAsync(EntityType.Article, ct);
        var anchor = job.ValidationAnchorJobId.HasValue
            ? await repository.GetJobSummaryAsync(job.ValidationAnchorJobId.Value, ct)
            : latest;
        var currentImpact = anchor is null
            ? new DependencyImpact(job.TotalRows, 0, job.TotalRows, 0, [])
            : await BuildDependencyImpactAsync(job, anchor.Id, ct);
        var latestImpact = latest is null || anchor?.Id == latest.Id
            ? null
            : await BuildDependencyImpactAsync(job, latest.Id, ct);
        var candidates = await repository.GetArticleMasterCandidatesAsync(userId, ct);
        var package = job.ReleasePackageId.HasValue
            ? await repository.GetReleasePackageSummaryAsync(job.ReleasePackageId.Value, ct)
            : null;
        var candidateSummaries = new List<ArticleMasterCandidateSummary>(candidates.Count);
        foreach (var candidate in candidates)
        {
            candidateSummaries.Add(await ToCandidateSummaryAsync(candidate, job, latest?.Id, userId, ct));
        }

        return new DependencyContext(
            job.Id,
            true,
            job.ValidationAnchorKind,
            job.ValidationAnchorPinnedAt,
            anchor is null ? null : await ToAnchorSummaryAsync(anchor, latest?.Id, job.ReleasePackageId, ct),
            latest is null ? null : await ToAnchorSummaryAsync(latest, latest.Id, null, ct),
            latest is not null && anchor?.Id != latest.Id,
            currentImpact,
            latestImpact,
            package is null ? null : ToReleaseSummary(package),
            package is null
                ? job.EntityType == EntityType.PriceList ? await BuildIndividualPortfolioReadinessAsync(job, ct) : null
                : await BuildPackagePortfolioReadinessAsync(package, ct),
            candidateSummaries);
    }

    public async Task<PortfolioReadiness> GetPortfolioReadinessAsync(
        Guid jobId, string userId, CancellationToken ct = default)
    {
        var job = await repository.GetJobSummaryAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");
        if (job.WorkflowStage == ImportWorkflowStage.Private
            && !string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("This private projected-state check belongs to another user.");
        if (job.EntityType is not (EntityType.Article or EntityType.PriceList))
            throw new InvalidOperationException("Projected portfolio readiness currently applies to Article Master and Price List datasets.");

        return await BuildIndividualPortfolioReadinessAsync(job, ct);
    }

    public async Task<IReadOnlyList<PriceListCandidateSummary>> GetPriceListCandidatesAsync(
        Guid articleJobId, string userId, CancellationToken ct = default)
    {
        var articleJob = await repository.GetJobSummaryAsync(articleJobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{articleJobId}' not found.");
        if (articleJob.EntityType != EntityType.Article)
            throw new InvalidOperationException("Price List candidates can only be selected for an Article Master draft.");
        if (articleJob.WorkflowStage == ImportWorkflowStage.Private
            && !string.Equals(articleJob.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("This private Article Master belongs to another user.");

        var activePrice = await repository.GetLatestCommittedJobAsync(EntityType.PriceList, ct);
        var candidates = await repository.GetPriceListCandidatesAsync(userId, ct);
        var summaries = new List<PriceListCandidateSummary>(candidates.Count);
        foreach (var candidate in candidates)
            summaries.Add(await ToPriceListCandidateSummaryAsync(candidate, articleJob, activePrice?.Id, userId, ct));
        return summaries;
    }

    public async Task<DependencyImpact> PreviewDependencyAnchorAsync(
        Guid jobId, Guid articleMasterJobId, string userId, CancellationToken ct = default)
    {
        var job = await GetEditablePrivateJobAsync(jobId, userId, "preview validation for", ct);
        EnsureDependentDataset(job);
        await EnsureSelectableArticleMasterAsync(articleMasterJobId, userId, allowPrivateCandidate: true, ct);
        return await BuildDependencyImpactAsync(job, articleMasterJobId, ct);
    }

    public async Task<ImportJob> ApplyDependencyAnchorAsync(
        Guid jobId,
        Guid articleMasterJobId,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var job = await GetEditablePrivateJobAsync(jobId, userId, "change validation for", ct);
        EnsureDependentDataset(job);
        var master = await EnsureSelectableArticleMasterAsync(articleMasterJobId, userId, allowPrivateCandidate: false, ct);
        job.ValidationAnchorJobId = master.Id;
        job.ValidationAnchorKind = ValidationAnchorKind.ExplicitVersion;
        job.ValidationAnchorPinnedAt = DateTime.UtcNow;
        job.ReleasePackageId = null;
        await RevalidateAgainstAnchorAsync(job, master.Id, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "ValidationAnchorChanged",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Revalidated against Article Master '{master.OriginalFileName}' ({master.Id:D}). Result: {job.ErrorRows} error rows."
        }, ct);
        return job;
    }

    public async Task<ReleasePackageSummary> CreateReleasePackageAsync(
        Guid jobId,
        Guid articleMasterJobId,
        string name,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var dependentJob = await GetEditablePrivateJobAsync(jobId, userId, "add to a release package", ct);
        EnsureDependentDataset(dependentJob);
        if (dependentJob.ReleasePackageId.HasValue)
            throw new InvalidOperationException("This draft already belongs to a release package.");
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 180)
            throw new InvalidDataException("Provide a release name of at most 180 characters.");
        var releaseName = name.Trim();
        if (await repository.IsReleaseNameInUseAsync(releaseName, ct: ct))
            throw new InvalidDataException($"A release named '{releaseName}' already exists. Choose another name.");

        var selectedMaster = await repository.GetJobAsync(articleMasterJobId, ct)
            ?? throw new KeyNotFoundException($"Article Master upload '{articleMasterJobId}' not found.");
        if (selectedMaster.EntityType != EntityType.Article)
            throw new InvalidOperationException("The selected release candidate is not an Article Master upload.");

        ImportJob masterJob;
        if (selectedMaster.WorkflowStage == ImportWorkflowStage.Private)
        {
            masterJob = await EnsureSelectableArticleMasterAsync(articleMasterJobId, userId, allowPrivateCandidate: true, ct);
        }
        else
        {
            if (selectedMaster.WorkflowStage is not (ImportWorkflowStage.Submitted
                or ImportWorkflowStage.Approved
                or ImportWorkflowStage.Published))
                throw new InvalidOperationException("Select an Article Master from your workspace, review, or publication history.");
            if (selectedMaster.ErrorRows > 0 && !await HasOnlyMissingPriceErrorsAsync(selectedMaster, ct))
                throw new InvalidOperationException("The selected Article Master contains blocking errors and cannot start a release.");

            var extension = Path.GetExtension(selectedMaster.OriginalFileName);
            var stem = Path.GetFileNameWithoutExtension(selectedMaster.OriginalFileName);
            const string separator = " - ";
            var maxReleaseNameLength = Math.Max(1, 180 - extension.Length - separator.Length - 1);
            var copyReleaseName = releaseName[..Math.Min(releaseName.Length, maxReleaseNameLength)];
            var suffix = $"{separator}{copyReleaseName}";
            var maxStemLength = Math.Max(1, 180 - extension.Length - suffix.Length);
            var workingCopyName = $"{stem[..Math.Min(stem.Length, maxStemLength)]}{suffix}{extension}";
            masterJob = await CopyToWorkspaceAsync(
                selectedMaster.Id, workingCopyName, userId, userDisplayName, ct);
        }

        if (masterJob.ReleasePackageId.HasValue)
            throw new InvalidOperationException("The selected Article Master already belongs to another release package.");

        var package = new ReleasePackage
        {
            Name = releaseName,
            CreatedBy = userId,
            CreatedByDisplayName = userDisplayName
        };
        await repository.AddReleasePackageAsync(package, ct);

        masterJob.ReleasePackageId = package.Id;
        dependentJob.ReleasePackageId = package.Id;
        dependentJob.ValidationAnchorJobId = masterJob.Id;
        dependentJob.ValidationAnchorKind = ValidationAnchorKind.ReleaseCandidate;
        dependentJob.ValidationAnchorPinnedAt = DateTime.UtcNow;
        await repository.UpdateJobAsync(masterJob, ct);
        await RevalidateArticlePriceCoverageAsync(masterJob, dependentJob.Id, ct);
        await RevalidateAgainstAnchorAsync(dependentJob, masterJob.Id, ct);

        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = dependentJob.Id,
            Action = "ReleasePackageCreated",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Created release package '{package.Name}' with Article Master {masterJob.Id:D}."
        }, ct);

        return ToReleaseSummary((await repository.GetReleasePackageSummaryAsync(package.Id, ct))!);
    }

    public async Task<ReleasePackageSummary> CreateReleasePackageFromArticleAsync(
        Guid articleJobId,
        Guid priceListJobId,
        string name,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var articleJob = await GetEditablePrivateJobAsync(articleJobId, userId, "add to a release package", ct);
        if (articleJob.EntityType != EntityType.Article)
            throw new InvalidOperationException("This release entry point requires an Article Master draft.");
        if (articleJob.ReleasePackageId.HasValue)
            throw new InvalidOperationException("This draft already belongs to a release package.");
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 180)
            throw new InvalidDataException("Provide a release name of at most 180 characters.");
        var releaseName = name.Trim();
        if (await repository.IsReleaseNameInUseAsync(releaseName, ct: ct))
            throw new InvalidDataException($"A release named '{releaseName}' already exists. Choose another name.");

        var selectedPrice = await repository.GetJobAsync(priceListJobId, ct)
            ?? throw new KeyNotFoundException($"Price List upload '{priceListJobId}' not found.");
        if (selectedPrice.EntityType != EntityType.PriceList)
            throw new InvalidOperationException("The selected release candidate is not a Price List upload.");

        ImportJob priceJob;
        if (selectedPrice.WorkflowStage == ImportWorkflowStage.Private)
        {
            if (!string.Equals(selectedPrice.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Private Price List candidates are only available to their owner.");
            priceJob = selectedPrice;
        }
        else
        {
            if (selectedPrice.WorkflowStage is not (ImportWorkflowStage.Submitted
                or ImportWorkflowStage.Approved
                or ImportWorkflowStage.Published))
                throw new InvalidOperationException("Select a Price List from your workspace, review, or publication history.");
            var extension = Path.GetExtension(selectedPrice.OriginalFileName);
            var stem = Path.GetFileNameWithoutExtension(selectedPrice.OriginalFileName);
            const string separator = " - ";
            var maxReleaseNameLength = Math.Max(1, 180 - extension.Length - separator.Length - 1);
            var copyReleaseName = releaseName[..Math.Min(releaseName.Length, maxReleaseNameLength)];
            var suffix = $"{separator}{copyReleaseName}";
            var maxStemLength = Math.Max(1, 180 - extension.Length - suffix.Length);
            var workingCopyName = $"{stem[..Math.Min(stem.Length, maxStemLength)]}{suffix}{extension}";
            priceJob = await CopyToWorkspaceAsync(
                selectedPrice.Id, workingCopyName, userId, userDisplayName, ct);
        }

        if (priceJob.ReleasePackageId.HasValue)
            throw new InvalidOperationException("The selected Price List already belongs to another release package.");

        var package = new ReleasePackage
        {
            Name = releaseName,
            CreatedBy = userId,
            CreatedByDisplayName = userDisplayName
        };
        await repository.AddReleasePackageAsync(package, ct);

        articleJob.ReleasePackageId = package.Id;
        priceJob.ReleasePackageId = package.Id;
        priceJob.ValidationAnchorJobId = articleJob.Id;
        priceJob.ValidationAnchorKind = ValidationAnchorKind.ReleaseCandidate;
        priceJob.ValidationAnchorPinnedAt = DateTime.UtcNow;
        await repository.UpdateJobAsync(articleJob, ct);
        await RevalidateArticlePriceCoverageAsync(articleJob, priceJob.Id, ct);
        await RevalidateAgainstAnchorAsync(priceJob, articleJob.Id, ct);

        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = articleJob.Id,
            Action = "ReleasePackageCreated",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Created release package '{package.Name}' with Price List {priceJob.Id:D}."
        }, ct);

        return ToReleaseSummary((await repository.GetReleasePackageSummaryAsync(package.Id, ct))!);
    }

    public async Task<ReleasePackageSummary> GetReleasePackageAsync(
        Guid packageId, string userId, bool canReview, CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageSummaryAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (!canReview && !string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("You cannot view this release package.");
        return ToReleaseSummary(package);
    }

    public async Task DissolveReleasePackageAsync(
        Guid packageId,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (!string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Only the release owner can dissolve this package.");
        if (package.Status != ReleasePackageStatus.Draft)
            throw new InvalidOperationException("Only a private draft release can be dissolved.");
        if (package.Jobs.Any(job => job.WorkflowStage != ImportWorkflowStage.Private))
            throw new InvalidOperationException("Every upload must be in the private workspace before this release can be dissolved.");

        var activeMaster = await repository.GetLatestCommittedJobAsync(EntityType.Article, ct);
        foreach (var job in package.Jobs.ToList())
        {
            job.ReleasePackageId = null;
            job.ReleasePackage = null;
            if (IsDependentDataset(job.EntityType)
                && job.ValidationAnchorKind == ValidationAnchorKind.ReleaseCandidate)
            {
                job.ValidationAnchorJobId = activeMaster?.Id;
                job.ValidationAnchorKind = activeMaster is null
                    ? ValidationAnchorKind.None
                    : ValidationAnchorKind.ActiveBaseline;
                job.ValidationAnchorPinnedAt = activeMaster is null ? null : DateTime.UtcNow;
                if (activeMaster is not null)
                    await RevalidateAgainstAnchorAsync(job, activeMaster.Id, ct);
            }
            else if (job.EntityType == EntityType.Article)
            {
                await RefreshArticlePriceCoverageAsync(job, ct);
            }

            await repository.UpdateJobAsync(job, ct);
            await repository.AddAuditLogAsync(new AuditLog
            {
                ImportJobId = job.Id,
                Action = "ReleasePackageDissolved",
                PerformedBy = userId,
                PerformedByDisplayName = userDisplayName,
                Details = $"Released from draft package '{package.Name}' ({package.Id:D}). The upload can be edited, reused, or submitted independently."
            }, ct);
        }

        package.Jobs.Clear();
        await repository.DeleteReleasePackageAsync(package, ct);
    }

    public async Task DiscardReleasePackageAsync(
        Guid packageId,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (!string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Only the change set owner can discard it.");
        if (package.Status != ReleasePackageStatus.Draft
            || package.Jobs.Any(job => job.WorkflowStage != ImportWorkflowStage.Private))
            throw new InvalidOperationException("Only a private draft change set can be discarded.");

        var jobs = package.Jobs.ToList();
        package.Jobs.Clear();
        foreach (var job in jobs)
        {
            job.ReleasePackageId = null;
            job.ReleasePackage = null;
            await repository.DeleteJobAsync(job, ct);
        }

        await repository.DeleteReleasePackageAsync(package, ct);
    }

    public async Task<ReleasePackageSummary> SubmitReleasePackageAsync(
        Guid packageId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var package = await GetOwnedDraftPackageAsync(packageId, userId, ct);
        ValidatePackageComposition(package);
        if (package.Jobs.Any(job => job.ErrorRows > 0 || job.Status != ImportStatus.AwaitingApproval))
            throw new InvalidOperationException("Every dataset must be error-free and ready before the release can be submitted.");
        await EnsurePortfolioIsConsistentAsync(await BuildPackagePortfolioReadinessAsync(package, ct), "submitted");

        foreach (var job in PackageOrder(package.Jobs))
            await SubmitForReviewAsync(job.Id, userId, userDisplayName, ct, coordinatedRelease: true);

        package.Status = ReleasePackageStatus.Submitted;
        package.SubmittedAt = DateTime.UtcNow;
        package.SubmittedByDisplayName = userDisplayName;
        await repository.SaveChangesAsync(ct);
        return ToReleaseSummary(package);
    }

    public async Task<ReleasePackageSummary> WithdrawReleasePackageAsync(
        Guid packageId,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (!string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Only the release owner can withdraw this release.");
        if (package.Status != ReleasePackageStatus.Submitted)
            throw new InvalidOperationException("Only a release currently waiting for approval can be withdrawn.");
        if (package.Jobs.Count < 2 || package.Jobs.Any(job =>
                job.WorkflowStage != ImportWorkflowStage.Submitted || job.Status != ImportStatus.AwaitingApproval))
            throw new InvalidOperationException("Every dataset in the release must still be waiting for approval before it can be withdrawn.");

        var withdrawnAt = DateTime.UtcNow;
        foreach (var job in package.Jobs)
        {
            job.WorkflowStage = ImportWorkflowStage.Private;
            job.WithdrawnAt = withdrawnAt;
            job.SubmittedComparisonJson = null;
        }

        package.Status = ReleasePackageStatus.Draft;
        package.SubmittedAt = null;
        package.SubmittedByDisplayName = null;
        await repository.SaveChangesAsync(ct);

        foreach (var job in package.Jobs)
        {
            await repository.AddAuditLogAsync(new AuditLog
            {
                ImportJobId = job.Id,
                Action = "ReleasePackageWithdrawn",
                PerformedBy = userId,
                PerformedByDisplayName = userDisplayName,
                Details = $"Withdrew coordinated release '{package.Name}' from approval. Every dataset returned to the owner's private workspace."
            }, ct);
        }

        return ToReleaseSummary(package);
    }

    public async Task<ReleasePackageSummary> ApproveReleasePackageAsync(
        Guid packageId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (package.Status != ReleasePackageStatus.Submitted)
            throw new InvalidOperationException("Only a submitted release package can be approved.");
        if (string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot approve your own release package.");
        ValidatePackageComposition(package);
        await EnsurePortfolioIsConsistentAsync(await BuildPackagePortfolioReadinessAsync(package, ct), "approved");

        foreach (var job in PackageOrder(package.Jobs))
            await ApproveAsync(job.Id, userId, userDisplayName, ct, coordinatedRelease: true);

        package.Status = ReleasePackageStatus.Approved;
        package.ApprovedAt = DateTime.UtcNow;
        package.ApprovedByUserId = userId;
        package.ApprovedByDisplayName = userDisplayName;
        package.ApprovalEvidenceJson = JsonSerializer.Serialize(new
        {
            package.Id,
            package.Name,
            package.ApprovedAt,
            package.ApprovedByUserId,
            Items = package.Jobs.Select(job => new { job.Id, job.EntityType, job.ValidationAnchorJobId, job.ApprovedComparisonJson })
        }, JsonOpts);
        await repository.SaveChangesAsync(ct);
        return ToReleaseSummary(package);
    }

    public async Task<ReleasePackageSummary> RejectReleasePackageAsync(
        Guid packageId, string userId, string userDisplayName, string reason, CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (package.Status != ReleasePackageStatus.Submitted)
            throw new InvalidOperationException("Only a submitted release package can be rejected.");
        if (string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot reject your own release package.");

        var trimmedReason = reason.Trim();
        if (trimmedReason.Length is 0 or > 2000)
            throw new InvalidDataException("Provide a rejection reason of at most 2000 characters.");
        if (package.Jobs.Any(job => job.Status != ImportStatus.AwaitingApproval || job.WorkflowStage != ImportWorkflowStage.Submitted))
            throw new InvalidOperationException("Every release item must still be awaiting approval before the release can be rejected.");

        var rejectedAt = DateTime.UtcNow;
        package.Status = ReleasePackageStatus.Rejected;
        package.RejectedAt = rejectedAt;
        package.RejectedByUserId = userId;
        package.RejectedByDisplayName = userDisplayName;
        package.RejectionReason = trimmedReason;

        foreach (var job in package.Jobs)
        {
            job.Status = ImportStatus.Rejected;
            job.WorkflowStage = ImportWorkflowStage.Rejected;
            job.RejectedAt = rejectedAt;
            job.RejectedBy = userDisplayName;
            job.RejectionReason = trimmedReason;
        }

        await repository.SaveChangesAsync(ct);
        foreach (var job in package.Jobs)
        {
            await repository.AddAuditLogAsync(new AuditLog
            {
                ImportJobId = job.Id,
                Action = "ReleasePackageRejected",
                PerformedBy = userId,
                PerformedByDisplayName = userDisplayName,
                Details = $"Release package '{package.Name}' rejected: {trimmedReason}"
            }, ct);
        }

        return ToReleaseSummary(package);
    }

    public async Task<ReleasePackageSummary> ReturnReleasePackageForCorrectionAsync(
        Guid packageId,
        string userId,
        string userDisplayName,
        string reason,
        CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (package.Status != ReleasePackageStatus.Submitted)
            throw new InvalidOperationException("Only a submitted release package can be returned for correction.");
        if (string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot review your own release package.");

        var trimmedReason = reason.Trim();
        if (trimmedReason.Length is 0 or > 2000)
            throw new InvalidDataException("Provide correction guidance of at most 2000 characters.");
        if (package.Jobs.Any(job => job.Status != ImportStatus.AwaitingApproval || job.WorkflowStage != ImportWorkflowStage.Submitted))
            throw new InvalidOperationException("Every release item must still be awaiting approval before it can be returned.");

        var returnedAt = DateTime.UtcNow;
        package.Status = ReleasePackageStatus.Draft;
        package.SubmittedAt = null;
        package.SubmittedByDisplayName = null;
        package.RejectedAt = returnedAt;
        package.RejectedByUserId = userId;
        package.RejectedByDisplayName = userDisplayName;
        package.RejectionReason = trimmedReason;

        foreach (var job in package.Jobs)
        {
            job.WorkflowStage = ImportWorkflowStage.Private;
            job.SubmittedComparisonJson = null;
            job.RejectedAt = returnedAt;
            job.RejectedBy = userDisplayName;
            job.RejectionReason = trimmedReason;
        }

        await repository.SaveChangesAsync(ct);
        foreach (var job in package.Jobs)
        {
            await repository.AddAuditLogAsync(new AuditLog
            {
                ImportJobId = job.Id,
                Action = "ReleasePackageReturnedForCorrection",
                PerformedBy = userId,
                PerformedByDisplayName = userDisplayName,
                Details = $"Returned maintenance release '{package.Name}' for correction: {trimmedReason}"
            }, ct);
        }

        return ToReleaseSummary(package);
    }

    public async Task<ReleasePackageSummary> PublishReleasePackageAsync(
        Guid packageId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (package.Status is not ReleasePackageStatus.Approved and not ReleasePackageStatus.Failed)
            throw new InvalidOperationException("Only an approved release package can be published.");
        ValidatePackageComposition(package);
        if (package.Jobs.Any(job => job.Status is not ImportStatus.Approved and not ImportStatus.Committed))
            throw new InvalidOperationException("Every release item must have approval evidence before publication.");
        await EnsurePortfolioIsConsistentAsync(await BuildPackagePortfolioReadinessAsync(package, ct), "published");

        package.Status = ReleasePackageStatus.Publishing;
        package.FailureReason = null;
        await repository.SaveChangesAsync(ct);
        try
        {
            foreach (var job in PackageOrder(package.Jobs).Where(job => job.Status != ImportStatus.Committed))
                await PublishAsync(job.Id, userId, userDisplayName, ct);

            package.Status = ReleasePackageStatus.Published;
            package.PublishedAt = DateTime.UtcNow;
            package.PublishedByDisplayName = userDisplayName;
            await repository.SaveChangesAsync(ct);
            return ToReleaseSummary(package);
        }
        catch (Exception ex)
        {
            package.Status = ReleasePackageStatus.Failed;
            package.FailureReason = ex.GetBaseException().Message[..Math.Min(ex.GetBaseException().Message.Length, 2000)];
            await repository.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }

    public async Task<ImportJob> CopyToWorkspaceAsync(
        Guid sourceJobId,
        string fileName,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var source = await repository.GetJobAsync(sourceJobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{sourceJobId}' not found.");

        if (source.WorkflowStage == ImportWorkflowStage.Private)
            throw new InvalidOperationException("Only uploads in the shared workflow or publication history can be copied.");

        if (string.IsNullOrWhiteSpace(fileName))
            throw new InvalidDataException("Provide a working-copy file name.");

        var sourceExtension = Path.GetExtension(source.FileName);
        if (string.IsNullOrWhiteSpace(sourceExtension))
            sourceExtension = Path.GetExtension(source.OriginalFileName);
        var requestedName = NormalizeUploadName(fileName, $"source{sourceExtension}");
        if (await repository.IsUploadNameInUseAsync(requestedName, ct: ct))
            throw new InvalidDataException($"An upload named '{Path.GetFileNameWithoutExtension(requestedName)}' already exists. Choose another name.");

        var sourceFile = await repository.GetUploadedFileAsync(source.Id, ct)
            ?? throw new InvalidDataException("The source file is no longer available and cannot be copied.");
        var sourceRows = await repository.GetStagingRowsByJobAsync(source.Id, ct);
        var now = DateTime.UtcNow;
        var job = new ImportJob
        {
            FileName = $"{Guid.NewGuid()}{sourceExtension}",
            OriginalFileName = requestedName,
            EntityType = source.EntityType,
            Status = sourceRows.Any(row => row.Status == RowStatus.Error)
                ? ImportStatus.NeedsCorrection
                : ImportStatus.AwaitingApproval,
            WorkflowStage = ImportWorkflowStage.Private,
            CreatedBy = userId,
            CreatedByDisplayName = userDisplayName,
            CreatedAt = now,
            ProcessedAt = now,
            TotalRows = sourceRows.Count,
            ValidRows = sourceRows.Count(row => row.Status == RowStatus.Valid),
            WarningRows = sourceRows.Count(row => row.Status == RowStatus.Warning),
            ErrorRows = sourceRows.Count(row => row.Status == RowStatus.Error)
            ,ValidationAnchorJobId = source.ValidationAnchorJobId
            ,ValidationAnchorKind = source.ValidationAnchorKind
            ,ValidationAnchorPinnedAt = source.ValidationAnchorPinnedAt
        };
        var rows = sourceRows.Select(row => new StagingRow
        {
            ImportJobId = job.Id,
            RowNumber = row.RowNumber,
            Status = row.Status,
            RawData = row.RawData,
            ValidationMessages = row.ValidationMessages,
            IsSelected = row.IsSelected
        }).ToList();
        var auditLog = new AuditLog
        {
            ImportJobId = job.Id,
            Action = "CopiedToWorkspace",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Created private working copy from {source.OriginalFileName} ({source.Id:D}, stage: {source.WorkflowStage}). Copied {rows.Count} active rows."
        };

        return await repository.CreateCopiedJobAsync(job, rows, requestedName, sourceFile, auditLog, ct);
    }

    public async Task<ImportJob> RenameUploadAsync(
        Guid jobId,
        string name,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");
        EnsurePrivateOwner(job, userId, "rename");

        var previousName = job.OriginalFileName;
        var normalizedName = NormalizeUploadName(name, previousName);
        if (string.Equals(previousName, normalizedName, StringComparison.Ordinal))
            return job;
        if (await repository.IsUploadNameInUseAsync(normalizedName, job.Id, ct))
            throw new InvalidDataException($"An upload named '{Path.GetFileNameWithoutExtension(normalizedName)}' already exists. Choose another name.");

        job.OriginalFileName = normalizedName;
        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Renamed",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Private upload renamed from '{previousName}' to '{normalizedName}'."
        }, ct);

        return job;
    }

    public async Task<ImportJob> WithdrawFromReviewAsync(
        Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (!string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Only the original uploader can withdraw this submission.");
        if (job.WorkflowStage != ImportWorkflowStage.Submitted || job.Status != ImportStatus.AwaitingApproval)
            throw new InvalidOperationException("Only a submission currently waiting for review can be withdrawn.");
        if (job.ReleasePackageId.HasValue)
            throw new InvalidOperationException("This upload belongs to a coordinated release and cannot be withdrawn individually.");

        job.WorkflowStage = ImportWorkflowStage.Private;
        job.WithdrawnAt = DateTime.UtcNow;
        job.SubmittedComparisonJson = null;

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Withdrawn",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = "Submission withdrawn from team review and returned to the uploader's private workspace."
        }, ct);

        return job;
    }

    public async Task DeletePrivateDraftAsync(
        Guid jobId,
        string userId,
        string userDisplayName,
        CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");
        EnsurePrivateOwner(job, userId, "delete");
        if (job.ReleasePackageId.HasValue)
            await DissolveReleasePackageAsync(job.ReleasePackageId.Value, userId, userDisplayName, ct);
        await repository.DeleteJobAsync(job, ct);
    }

    public async Task<ImportJob> ApproveAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default, bool coordinatedRelease = false)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status != ImportStatus.AwaitingApproval)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be approved.");

        if (job.WorkflowStage != ImportWorkflowStage.Submitted)
            throw new InvalidOperationException("The uploader must submit this private upload before it can be approved.");

        if (job.ReleasePackageId.HasValue && !coordinatedRelease)
            throw new InvalidOperationException("This upload belongs to a coordinated release and must be approved from the release package.");

        if (string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot approve your own submission.");

        if (job.ErrorRows > 0)
            throw new InvalidOperationException("Blocking errors must be corrected before approval.");
        if (!coordinatedRelease && job.EntityType is EntityType.Article or EntityType.PriceList)
            await EnsurePortfolioIsConsistentAsync(await BuildIndividualPortfolioReadinessAsync(job, ct), "approved independently");

        var comparison = await repository.GetComparisonAsync(jobId, ct);
        // Pre-workflow submissions were already shared without a frozen snapshot.
        var submittedComparison = string.IsNullOrWhiteSpace(job.SubmittedComparisonJson)
            ? comparison
            : DeserializeSubmittedComparison(job.SubmittedComparisonJson);
        if (submittedComparison.HasBaseline != comparison.HasBaseline
            || (submittedComparison.HasBaseline && submittedComparison.BaselineJobId != comparison.BaselineJobId))
        {
            throw new InvalidOperationException("The active baseline changed after submission. The uploader must withdraw, refresh, and submit the comparison again.");
        }

        var approvedAt = DateTime.UtcNow;
        var approvalSnapshot = new ApprovedComparisonSnapshot(
            SchemaVersion: 1,
            ApprovedAtUtc: approvedAt,
            ApprovedByUserId: userId,
            ApprovedByDisplayName: userDisplayName,
            Comparison: submittedComparison);

        job.Status = ImportStatus.Approved;
        job.WorkflowStage = ImportWorkflowStage.Approved;
        job.ApprovedAt = approvedAt;
        job.ApprovedByUserId = userId;
        job.ApprovedByDisplayName = userDisplayName;
        job.ApprovedComparisonJson = JsonSerializer.Serialize(approvalSnapshot, JsonOpts);

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Approved",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Approved for publication: {submittedComparison.NewRows} new, {submittedComparison.ModifiedRows} modified, and {submittedComparison.MissingBaselineRows} scoped deletions."
        }, ct);

        return job;
    }

    public async Task<ImportJob> ReturnToReviewAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status != ImportStatus.Approved)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be returned to review.");
        if (job.ReleasePackageId.HasValue)
            throw new InvalidOperationException("This upload belongs to a coordinated release and cannot be returned individually.");

        job.Status = ImportStatus.AwaitingApproval;
        job.WorkflowStage = ImportWorkflowStage.Submitted;
        job.ApprovedAt = null;
        job.ApprovedByUserId = null;
        job.ApprovedByDisplayName = null;
        job.ApprovedComparisonJson = null;
        job.SubmittedComparisonJson = JsonSerializer.Serialize(await repository.GetComparisonAsync(jobId, ct), JsonOpts);

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "ApprovalReturned",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = "Approval withdrawn and submission returned to review before publication."
        }, ct);

        return job;
    }

    public async Task<ImportJob> ReturnForCorrectionAsync(
        Guid jobId,
        string userId,
        string userDisplayName,
        string reason,
        CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");
        if (job.WorkflowStage != ImportWorkflowStage.Submitted || job.Status != ImportStatus.AwaitingApproval)
            throw new InvalidOperationException("Only a request awaiting approval can be returned for correction.");
        if (job.ReleasePackageId.HasValue)
            throw new InvalidOperationException("This request belongs to a coordinated release and must be returned as a complete change set.");
        if (string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot review your own maintenance request.");

        var trimmedReason = reason.Trim();
        if (trimmedReason.Length is 0 or > 2000)
            throw new InvalidDataException("Provide correction guidance of at most 2000 characters.");

        job.WorkflowStage = ImportWorkflowStage.Private;
        job.SubmittedComparisonJson = null;
        job.RejectedAt = DateTime.UtcNow;
        job.RejectedBy = userDisplayName;
        job.RejectionReason = trimmedReason;
        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "ReturnedForCorrection",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Returned maintenance request for correction: {trimmedReason}"
        }, ct);
        return job;
    }

    public async Task<ImportJob> PublishAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status != ImportStatus.Approved)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be published.");

        if (job.ReleasePackageId.HasValue)
        {
            var package = await repository.GetReleasePackageAsync(job.ReleasePackageId.Value, ct)
                ?? throw new InvalidOperationException("The release package linked to this upload no longer exists.");
            if (package.Status != ReleasePackageStatus.Publishing)
                throw new InvalidOperationException("This upload belongs to a coordinated release and must be published from the release package.");
        }
        else if (job.EntityType is EntityType.Article or EntityType.PriceList)
        {
            await EnsurePortfolioIsConsistentAsync(await BuildIndividualPortfolioReadinessAsync(job, ct), "published independently");
        }

        if (string.IsNullOrWhiteSpace(job.ApprovedComparisonJson))
            throw new InvalidOperationException("The persisted approval record is missing. Return the submission to review and approve it again.");

        ApprovedComparisonSnapshot approvalSnapshot;
        try
        {
            approvalSnapshot = JsonSerializer.Deserialize<ApprovedComparisonSnapshot>(job.ApprovedComparisonJson, JsonOpts)
                ?? throw new InvalidDataException("The persisted approval record is empty.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException("The persisted approval record is invalid.", ex);
        }

        var approvedComparison = approvalSnapshot.Comparison;
        var currentComparison = await repository.GetComparisonAsync(jobId, ct);
        var baselineChanged = approvedComparison.HasBaseline != currentComparison.HasBaseline
            || (approvedComparison.HasBaseline && approvedComparison.BaselineJobId != currentComparison.BaselineJobId);
        if (baselineChanged)
        {
            throw new InvalidOperationException(
                "The active baseline changed after this approval. Return the submission to review and approve the recalculated impact before publishing.");
        }

        var removedKeys = approvedComparison.HasBaseline
            ? approvedComparison.MissingRows
                .Select(item => item.Key)
                .Where(key => !string.IsNullOrWhiteSpace(key))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
            : [];

        var strategy = commitStrategies.FirstOrDefault(s => s.EntityType == job.EntityType)
            ?? throw new InvalidOperationException($"No publication strategy for dataset '{DatasetCatalog.Get(job.EntityType).DisplayName}'.");

        // Retrieve all valid + warning rows
        var allRows = new List<StagingRow>();
        int page = 1;
        while (true)
        {
            var (items, total) = await repository.GetStagingRowsPagedAsync(jobId, page, 500, null, null, null, ct);
            allRows.AddRange(items.Where(r => r.Status != RowStatus.Error));
            if (allRows.Count >= total || items.Count == 0) break;
            page++;
        }

        var rowDicts = allRows
            .Select(r => JsonSerializer.Deserialize<Dictionary<string, string?>>(r.RawData, JsonOpts)!)
            .ToList();

        await strategy.CommitRowsAsync(rowDicts, removedKeys, ct);

        job.Status = ImportStatus.Committed;
        job.WorkflowStage = ImportWorkflowStage.Published;
        job.CommittedAt = DateTime.UtcNow;
        job.CommittedBy = userDisplayName;
        job.CommittedRows = rowDicts.Count;

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Published",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Published {job.CommittedRows} rows to CPQ using the approval recorded at {approvalSnapshot.ApprovedAtUtc:O}."
        }, ct);

        return job;
    }

    public async Task<ImportJob> CancelAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status is ImportStatus.Approved or ImportStatus.Committed or ImportStatus.Rejected or ImportStatus.Failed or ImportStatus.Cancelled)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be cancelled.");

        if (job.Status is not ImportStatus.AwaitingApproval and not ImportStatus.NeedsCorrection and not ImportStatus.Processing)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be cancelled.");

        job.Status = ImportStatus.Cancelled;
        job.WorkflowStage = ImportWorkflowStage.Withdrawn;
        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Cancelled",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = "Import request cancelled by uploader. A corrected file can be submitted as a new import."
        }, ct);

        return job;
    }

    public async Task<ImportJob> RejectAsync(Guid jobId, string userId, string userDisplayName,
        string reason, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status != ImportStatus.AwaitingApproval)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be rejected.");

        if (job.WorkflowStage != ImportWorkflowStage.Submitted)
            throw new InvalidOperationException("Only a formally submitted upload can be returned with feedback.");
        if (job.ReleasePackageId.HasValue)
            throw new InvalidOperationException("This upload belongs to a coordinated release and cannot be rejected individually.");

        if (string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot review your own submission.");

        job.Status = ImportStatus.Rejected;
        job.WorkflowStage = ImportWorkflowStage.Rejected;
        job.RejectedAt = DateTime.UtcNow;
        job.RejectedBy = userDisplayName;
        job.RejectionReason = reason;

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Rejected",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = reason
        }, ct);

        return job;
    }

    public Task<ImportComparisonResult> GetComparisonAsync(Guid jobId, CancellationToken ct = default)
        => repository.GetComparisonAsync(jobId, ct);

    public async Task<ApprovedComparisonSnapshot?> GetApprovedComparisonSnapshotAsync(
        Guid jobId,
        CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (string.IsNullOrWhiteSpace(job.ApprovedComparisonJson))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<ApprovedComparisonSnapshot>(job.ApprovedComparisonJson, JsonOpts);
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException($"The approval snapshot for import job '{jobId}' is invalid.", ex);
        }
    }

    public Task<IReadOnlySet<string>> GetLatestApprovedArticleNumbersAsync(CancellationToken ct = default)
        => repository.GetLatestApprovedArticleNumbersAsync(ct);

    public Task<byte[]?> GetOriginalFileAsync(Guid jobId, CancellationToken ct = default)
        => repository.GetUploadedFileAsync(jobId, ct);

    public async Task<DraftWorkingCopy> GenerateWorkingCopyAsync(Guid jobId, string userId, CancellationToken ct = default)
    {
        var job = await GetEditablePrivateJobAsync(jobId, userId, "export", ct);
        var original = await repository.GetUploadedFileAsync(jobId, ct)
            ?? throw new KeyNotFoundException("The original uploaded file is not available.");
        var rows = await repository.GetStagingRowsByJobAsync(jobId, ct);
        var dictionaries = rows.Select(row => DeserializeFields(row.RawData)).ToList();

        await using var source = new MemoryStream(original, writable: false);
        var (originalHeaders, _) = await RawFileReader.ReadAsync(source, job.OriginalFileName, ct);
        var headers = originalHeaders
            .Concat(dictionaries.SelectMany(fields => fields.Keys))
            .Where(header => !string.IsNullOrWhiteSpace(header))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var stem = Path.GetFileNameWithoutExtension(job.OriginalFileName);

        if (Path.GetExtension(job.OriginalFileName).Equals(".csv", StringComparison.OrdinalIgnoreCase))
        {
            using var writer = new StringWriter(CultureInfo.InvariantCulture);
            using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
            {
                foreach (var header in headers) csv.WriteField(header);
                await csv.NextRecordAsync();
                foreach (var fields in dictionaries)
                {
                    ct.ThrowIfCancellationRequested();
                    foreach (var header in headers) csv.WriteField(fields.GetValueOrDefault(header));
                    await csv.NextRecordAsync();
                }
            }

            return new DraftWorkingCopy(
                Encoding.UTF8.GetBytes(writer.ToString()),
                $"{stem}_working-copy.csv",
                "text/csv");
        }

        ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        using var package = new ExcelPackage(new MemoryStream(original));
        var worksheet = package.Workbook.Worksheets.First();
        var columnCount = Math.Max(headers.Count, worksheet.Dimension?.Columns ?? 0);
        var previousRowCount = worksheet.Dimension?.Rows ?? 1;

        for (var column = 1; column <= headers.Count; column++)
        {
            worksheet.Cells[1, column].Value = headers[column - 1];
        }

        for (var rowIndex = 0; rowIndex < dictionaries.Count; rowIndex++)
        {
            var excelRow = rowIndex + 2;
            if (excelRow > previousRowCount && previousRowCount >= 2)
            {
                worksheet.Cells[2, 1, 2, columnCount].Copy(worksheet.Cells[excelRow, 1, excelRow, columnCount]);
            }

            for (var column = 0; column < headers.Count; column++)
            {
                worksheet.Cells[excelRow, column + 1].Value = dictionaries[rowIndex].GetValueOrDefault(headers[column]);
            }
        }

        for (var excelRow = dictionaries.Count + 2; excelRow <= previousRowCount; excelRow++)
        {
            for (var column = 1; column <= columnCount; column++) worksheet.Cells[excelRow, column].Value = null;
        }

        return new DraftWorkingCopy(
            package.GetAsByteArray(),
            $"{stem}_working-copy.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    public Task<byte[]> GenerateTemplateAsync(EntityType entityType, CancellationToken ct = default)
        => Task.FromResult(TemplateGenerator.Generate(entityType));

    public async Task<byte[]> GenerateErrorReportAsync(Guid jobId, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        var errorRows = new List<StagingRow>();
        int page = 1;
        while (true)
        {
            var (items, total) = await repository.GetStagingRowsPagedAsync(jobId, page, 500, null, RowStatus.Error, null, ct);
            errorRows.AddRange(items);
            if (errorRows.Count >= total || items.Count == 0) break;
            page++;
        }

        if (errorRows.Count == 0)
        {
            throw new InvalidOperationException("This import has no error rows to export.");
        }

        ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("Errors");

        // Build a superset of all fields from error rows
        var allFields = errorRows
            .SelectMany(r => JsonSerializer.Deserialize<Dictionary<string, string?>>(r.RawData, JsonOpts)!.Keys)
            .Distinct()
            .OrderBy(k => k)
            .ToList();

        var headers = new[] { "Row", "Status" }.Concat(allFields).Concat(["Validation Errors"]).ToList();

        for (int c = 0; c < headers.Count; c++)
        {
            var cell = ws.Cells[1, c + 1];
            cell.Value = headers[c];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(0xC0, 0x00, 0x00));
            cell.Style.Font.Color.SetColor(Color.White);
        }

        for (int i = 0; i < errorRows.Count; i++)
        {
            var row = errorRows[i];
            var fields = JsonSerializer.Deserialize<Dictionary<string, string?>>(row.RawData, JsonOpts)!;
            var msgs = row.ValidationMessages != null
                ? JsonSerializer.Deserialize<List<ValidationMessage>>(row.ValidationMessages, JsonOpts)!
                : [];

            int rowNum = i + 2;
            ws.Cells[rowNum, 1].Value = row.RowNumber;
            ws.Cells[rowNum, 2].Value = row.Status.ToString();
            for (int c = 0; c < allFields.Count; c++)
                ws.Cells[rowNum, c + 3].Value = fields.GetValueOrDefault(allFields[c]);

            ws.Cells[rowNum, headers.Count].Value =
                string.Join(" | ", msgs.Select(m => $"[{m.Severity}] {m.Field}: {m.Message}"));

            if (row.Status == RowStatus.Error)
            {
                var rowRange = ws.Cells[rowNum, 1, rowNum, headers.Count];
                rowRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                rowRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(0xFF, 0xE0, 0xE0));
            }
        }

        if (ws.Dimension is not null)
        {
            ws.Cells[ws.Dimension.Address].AutoFitColumns();
        }

        return package.GetAsByteArray();
    }

    public async Task<byte[]> GenerateComparisonReportAsync(Guid jobId, CancellationToken ct = default)
    {
        var comparison = await repository.GetComparisonAsync(jobId, ct);
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (!comparison.HasBaseline)
        {
            throw new InvalidOperationException("This import has no baseline comparison to export.");
        }

        if (comparison.NewRows == 0 && comparison.ModifiedRows == 0 && comparison.MissingBaselineRows == 0)
        {
            throw new InvalidOperationException("This import has no comparison differences to export.");
        }

        var currentRows = new List<StagingRow>();
        int page = 1;
        while (true)
        {
            var (items, total) = await repository.GetStagingRowsPagedAsync(jobId, page, 500, null, null, null, ct);
            currentRows.AddRange(items);
            if (currentRows.Count >= total || items.Count == 0)
            {
                break;
            }
            page++;
        }

        var currentRowLookup = currentRows.ToDictionary(
            r => r.Id,
            r => (IReadOnlyDictionary<string, string?>)DeserializeFields(r.RawData));

        ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        using var package = new ExcelPackage();

        var summary = package.Workbook.Worksheets.Add("Summary");
        summary.Cells[1, 1].Value = "Comparison report";
        summary.Cells[2, 1].Value = "Job";
        summary.Cells[2, 2].Value = job.OriginalFileName;
        summary.Cells[3, 1].Value = "Dataset";
        summary.Cells[3, 2].Value = DatasetCatalog.Get(job.EntityType).DisplayName;
        summary.Cells[4, 1].Value = "Baseline job";
        summary.Cells[4, 2].Value = comparison.BaselineJobId.ToString("D");
        summary.Cells[5, 1].Value = "Compared rows";
        summary.Cells[5, 2].Value = comparison.ComparedRows;
        summary.Cells[6, 1].Value = "New rows";
        summary.Cells[6, 2].Value = comparison.NewRows;
        summary.Cells[7, 1].Value = "Modified rows";
        summary.Cells[7, 2].Value = comparison.ModifiedRows;
        summary.Cells[8, 1].Value = "Unchanged rows";
        summary.Cells[8, 2].Value = comparison.UnchangedRows;
        summary.Cells[9, 1].Value = "Missing rows";
        summary.Cells[9, 2].Value = comparison.MissingBaselineRows;

        summary.Cells[1, 1, 1, 2].Style.Font.Bold = true;
        summary.Cells[1, 1, 1, 2].Style.Font.Size = 14;
        summary.Cells[2, 1, 9, 1].Style.Font.Bold = true;
        summary.Cells[2, 1, 9, 2].AutoFitColumns();

        WriteNewRowsSheet(package, comparison, currentRowLookup);
        WriteModifiedRowsSheet(package, comparison);

        var missing = package.Workbook.Worksheets.Add("Missing");
        var missingHeaders = new[] { "Key" }.Concat(
            comparison.MissingRows.SelectMany(m => m.BaselineValues.Keys)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(k => k)).ToList();

        for (int c = 0; c < missingHeaders.Count; c++)
        {
            var cell = missing.Cells[1, c + 1];
            cell.Value = missingHeaders[c];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(0x1D, 0x4E, 0xD8));
            cell.Style.Font.Color.SetColor(Color.White);
        }

        for (int i = 0; i < comparison.MissingRows.Count; i++)
        {
            var item = comparison.MissingRows[i];
            missing.Cells[i + 2, 1].Value = item.Key;
            for (int c = 1; c < missingHeaders.Count; c++)
            {
                var header = missingHeaders[c];
                item.BaselineValues.TryGetValue(header, out var value);
                missing.Cells[i + 2, c + 1].Value = value;
            }
        }

        if (missing.Dimension is not null)
        {
            missing.Cells[missing.Dimension.Address].AutoFitColumns();
        }

        return package.GetAsByteArray();
    }

    private static void WriteNewRowsSheet(ExcelPackage package, ImportComparisonResult comparison, IReadOnlyDictionary<Guid, IReadOnlyDictionary<string, string?>> currentRowLookup)
    {
        var newRows = comparison.Rows.Where(r => r.ComparisonStatus == "New").ToList();
        if (newRows.Count == 0)
        {
            return;
        }

        var ws = package.Workbook.Worksheets.Add("New");
        var fieldHeaders = newRows
            .Select(row => currentRowLookup.TryGetValue(row.RowId, out var fields) ? fields.Keys : [])
            .SelectMany(keys => keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(k => k)
            .ToList();

        var headers = new[] { "Row", "Key" }.Concat(fieldHeaders).ToList();
        WriteHeaderRow(ws, headers);

        for (int i = 0; i < newRows.Count; i++)
        {
            var row = newRows[i];
            currentRowLookup.TryGetValue(row.RowId, out var fields);
            fields ??= new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

            ws.Cells[i + 2, 1].Value = row.RowNumber;
            ws.Cells[i + 2, 2].Value = row.Key;
            for (int c = 0; c < fieldHeaders.Count; c++)
            {
                fields.TryGetValue(fieldHeaders[c], out var value);
                ws.Cells[i + 2, c + 3].Value = value;
            }
        }

        AutoFit(ws);
    }

    private static void WriteModifiedRowsSheet(ExcelPackage package, ImportComparisonResult comparison)
    {
        var modifiedRows = comparison.Rows.Where(r => r.ComparisonStatus == "Modified").ToList();
        if (modifiedRows.Count == 0)
        {
            return;
        }

        var ws = package.Workbook.Worksheets.Add("Modified");
        var headers = new[]
        {
            "Row",
            "Key",
            "Changed field count",
            "Field",
            "Current value",
            "Baseline value"
        };

        WriteHeaderRow(ws, headers);

        int rowIndex = 2;
        foreach (var row in modifiedRows)
        {
            var visibleChanges = row.Changes.Where(c => c.IsDifferent).ToList();
            if (visibleChanges.Count == 0)
            {
                continue;
            }

            for (int i = 0; i < visibleChanges.Count; i++)
            {
                var change = visibleChanges[i];
                ws.Cells[rowIndex, 1].Value = i == 0 ? row.RowNumber : null;
                ws.Cells[rowIndex, 2].Value = i == 0 ? row.Key : null;
                ws.Cells[rowIndex, 3].Value = i == 0 ? row.ChangedFieldCount : null;
                ws.Cells[rowIndex, 4].Value = change.Field;
                ws.Cells[rowIndex, 5].Value = change.CurrentValue;
                ws.Cells[rowIndex, 6].Value = change.BaselineValue;
                rowIndex++;
            }
        }

        AutoFit(ws);
    }

    private static void WriteHeaderRow(ExcelWorksheet ws, IReadOnlyList<string> headers)
    {
        for (int c = 0; c < headers.Count; c++)
        {
            var cell = ws.Cells[1, c + 1];
            cell.Value = headers[c];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(0x1D, 0x4E, 0xD8));
            cell.Style.Font.Color.SetColor(Color.White);
        }
    }

    private static void AutoFit(ExcelWorksheet ws)
    {
        if (ws.Dimension is not null)
        {
            ws.Cells[ws.Dimension.Address].AutoFitColumns();
        }
    }

    private async Task RecalculateJobAsync(ImportJob job, CancellationToken ct)
    {
        var allRows = new List<StagingRow>();
        int page = 1;
        while (true)
        {
            var (items, total) = await repository.GetStagingRowsPagedAsync(job.Id, page, 500, null, null, null, ct);
            allRows.AddRange(items);
            if (allRows.Count >= total || items.Count == 0)
                break;
            page++;
        }

        job.TotalRows = allRows.Count;
        job.ValidRows = allRows.Count(r => r.Status == RowStatus.Valid);
        job.WarningRows = allRows.Count(r => r.Status == RowStatus.Warning);
        job.ErrorRows = allRows.Count(r => r.Status == RowStatus.Error);
        job.Status = job.ErrorRows > 0 ? ImportStatus.NeedsCorrection : ImportStatus.AwaitingApproval;
        job.ProcessedAt = DateTime.UtcNow;

        await repository.UpdateJobAsync(job, ct);
    }

    private async Task ApplyCurrentBaselineValidationAsync(
        EntityType entityType,
        Dictionary<string, string?> fields,
        List<ValidationMessage> messages,
        IReadOnlySet<string>? approvedArticles,
        IReadOnlySet<string>? activePriceArticles,
        CancellationToken ct)
    {
        if (entityType == EntityType.Article)
        {
            var masterArticleNumber = GetArticleNumber(fields);
            if (activePriceArticles is not null
                && !string.IsNullOrWhiteSpace(masterArticleNumber)
                && !activePriceArticles.Contains(masterArticleNumber))
            {
                messages.Add(new ValidationMessage
                {
                    Field = "ArticleNumber",
                    Message = $"Article '{masterArticleNumber}' has no matching price in the active Price List.",
                    Severity = ValidationSeverity.Error
                });
            }

            return;
        }

        if (!IsDependentDataset(entityType))
        {
            return;
        }

        approvedArticles ??= await repository.GetLatestApprovedArticleNumbersAsync(ct);
        var articleNumber = fields.TryGetValue("ArticleNumber", out var value) ? value?.Trim() : null;
        if (string.IsNullOrWhiteSpace(articleNumber) || approvedArticles.Contains(articleNumber))
        {
            return;
        }

        messages.Add(new ValidationMessage
        {
            Field = "ArticleNumber",
            Message = $"Article '{articleNumber}' does not exist in the selected Article Master validation context.",
            Severity = ValidationSeverity.Error
        });
    }

    private async Task<IReadOnlySet<string>> GetActivePriceArticleNumbersAsync(CancellationToken ct)
    {
        var activePrice = await repository.GetLatestCommittedJobAsync(EntityType.PriceList, ct);
        return activePrice is null
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : await GetReferencedArticleNumbersAsync(activePrice.Id, ct);
    }

    private async Task<IReadOnlySet<string>> GetArticlePriceContextAsync(
        ImportJob articleJob,
        CancellationToken ct)
    {
        if (articleJob.ReleasePackageId.HasValue)
        {
            var package = await repository.GetReleasePackageSummaryAsync(articleJob.ReleasePackageId.Value, ct);
            var releasePrice = package?.Jobs.FirstOrDefault(job => job.EntityType == EntityType.PriceList);
            if (releasePrice is not null)
                return await GetReferencedArticleNumbersAsync(releasePrice.Id, ct);
        }

        return await GetActivePriceArticleNumbersAsync(ct);
    }

    private async Task<bool> HasOnlyMissingPriceErrorsAsync(ImportJob job, CancellationToken ct)
    {
        if (job.EntityType != EntityType.Article || job.ErrorRows == 0)
            return false;

        var rows = await repository.GetStagingRowsByJobAsync(job.Id, ct);
        var errorRows = rows.Where(row => row.Status == RowStatus.Error).ToList();
        return errorRows.Count > 0
            && errorRows.All(row => DeserializeMessages(row.ValidationMessages)
                .Where(message => message.Severity == ValidationSeverity.Error)
                .All(IsMissingPriceError));
    }

    private static bool IsMissingPriceError(ValidationMessage message)
        => message.Field.Equals("ArticleNumber", StringComparison.OrdinalIgnoreCase)
            && message.Message.Contains("has no matching price in the active Price List", StringComparison.OrdinalIgnoreCase);

    private async Task RevalidateArticlePriceCoverageAsync(ImportJob articleJob, Guid priceJobId, CancellationToken ct)
    {
        if (articleJob.EntityType != EntityType.Article)
            return;

        var parser = GetParser(articleJob.EntityType);
        var priceArticles = await GetReferencedArticleNumbersAsync(priceJobId, ct);
        var rows = await repository.GetStagingRowsByJobAsync(articleJob.Id, ct);
        foreach (var row in rows)
        {
            var fields = DeserializeFields(row.RawData);
            var messages = parser.ValidateRow(fields);
            await ApplyCurrentBaselineValidationAsync(articleJob.EntityType, fields, messages, null, priceArticles, ct);
            row.RawData = JsonSerializer.Serialize(fields, JsonOpts);
            row.ValidationMessages = messages.Count > 0 ? JsonSerializer.Serialize(messages, JsonOpts) : null;
            row.Status = RowValidator.DeriveStatus(messages);
        }

        ApplyDuplicateArticleValidation(rows);
        ApplyJobTotals(articleJob, rows);
        await repository.SaveChangesAsync(ct);
    }

    private async Task RefreshArticlePriceCoverageAsync(ImportJob articleJob, CancellationToken ct)
    {
        var activePriceArticles = await GetArticlePriceContextAsync(articleJob, ct);
        var parser = GetParser(articleJob.EntityType);
        var rows = await repository.GetStagingRowsByJobAsync(articleJob.Id, ct);
        var originalState = rows
            .Select(row => (row.Status, row.ValidationMessages))
            .ToList();
        foreach (var row in rows)
        {
            var fields = DeserializeFields(row.RawData);
            var messages = parser.ValidateRow(fields);
            await ApplyCurrentBaselineValidationAsync(articleJob.EntityType, fields, messages, null, activePriceArticles, ct);
            row.ValidationMessages = messages.Count > 0 ? JsonSerializer.Serialize(messages, JsonOpts) : null;
            row.Status = RowValidator.DeriveStatus(messages);
        }

        // Duplicate detection is cross-row, so it must run after per-row validation.
        // Skipping it here previously wiped duplicate-article errors on every read.
        ApplyDuplicateArticleValidation(rows);

        var changed = rows
            .Where((row, index) => row.Status != originalState[index].Status
                || !string.Equals(row.ValidationMessages, originalState[index].ValidationMessages, StringComparison.Ordinal))
            .Any();

        if (changed)
        {
            ApplyJobTotals(articleJob, rows);
            await repository.SaveChangesAsync(ct);
        }
    }

    private async Task<IReadOnlySet<string>?> GetAnchoredArticleNumbersAsync(ImportJob job, CancellationToken ct)
    {
        if (!IsDependentDataset(job.EntityType))
            return null;

        if (!job.ValidationAnchorJobId.HasValue)
        {
            var activeMaster = await repository.GetLatestCommittedJobAsync(EntityType.Article, ct);
            if (activeMaster is null)
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            job.ValidationAnchorJobId = activeMaster.Id;
            job.ValidationAnchorKind = ValidationAnchorKind.ActiveBaseline;
            job.ValidationAnchorPinnedAt = DateTime.UtcNow;
        }

        return await repository.GetArticleNumbersForJobAsync(job.ValidationAnchorJobId.Value, ct);
    }

    private async Task RevalidateAgainstAnchorAsync(ImportJob job, Guid anchorJobId, CancellationToken ct)
    {
        var parser = GetParser(job.EntityType);
        var articleNumbers = await repository.GetArticleNumbersForJobAsync(anchorJobId, ct);
        var rows = await repository.GetStagingRowsByJobAsync(job.Id, ct);
        foreach (var row in rows)
        {
            var fields = DeserializeFields(row.RawData);
            var messages = parser.ValidateRow(fields);
            await ApplyCurrentBaselineValidationAsync(job.EntityType, fields, messages, articleNumbers, null, ct);
            row.RawData = JsonSerializer.Serialize(fields, JsonOpts);
            row.ValidationMessages = messages.Count > 0 ? JsonSerializer.Serialize(messages, JsonOpts) : null;
            row.Status = RowValidator.DeriveStatus(messages);
        }

        if (job.EntityType is EntityType.Article or EntityType.PriceList)
            ApplyDuplicateArticleValidation(rows);
        ApplyJobTotals(job, rows);
        await repository.SaveChangesAsync(ct);
    }

    private async Task<DependencyImpact> BuildDependencyImpactAsync(ImportJob job, Guid articleMasterJobId, CancellationToken ct)
    {
        var masterArticles = await repository.GetArticleNumbersForJobAsync(articleMasterJobId, ct);
        var rows = await repository.GetStagingRowsByJobAsync(job.Id, ct);
        var referenced = rows
            .Select(row => GetArticleNumber(DeserializeFields(row.RawData)))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!)
            .ToList();
        var missingRows = referenced.Where(article => !masterArticles.Contains(article)).ToList();
        var missing = missingRows
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(article => article, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var referencedSet = referenced.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return new DependencyImpact(
            rows.Count,
            rows.Count(row =>
            {
                var article = GetArticleNumber(DeserializeFields(row.RawData));
                return !string.IsNullOrWhiteSpace(article) && masterArticles.Contains(article);
            }),
            missingRows.Count,
            masterArticles.Count(article => !referencedSet.Contains(article)),
            missing.Take(100).ToList());
    }

    private async Task<PortfolioReadiness> BuildIndividualPortfolioReadinessAsync(ImportJob candidate, CancellationToken ct)
    {
        var master = candidate.EntityType == EntityType.Article
            ? candidate
            : await repository.GetLatestCommittedJobAsync(EntityType.Article, ct);
        var price = candidate.EntityType == EntityType.PriceList
            ? candidate
            : await repository.GetLatestCommittedJobAsync(EntityType.PriceList, ct);
        return await BuildPortfolioReadinessAsync(candidate.Id, candidate.EntityType, master, price, ct);
    }

    private async Task<PortfolioReadiness> BuildPackagePortfolioReadinessAsync(ReleasePackage package, CancellationToken ct)
    {
        var master = package.Jobs.Single(job => job.EntityType == EntityType.Article);
        var price = package.Jobs.FirstOrDefault(job => job.EntityType == EntityType.PriceList)
            ?? await repository.GetLatestCommittedJobAsync(EntityType.PriceList, ct);
        return await BuildPortfolioReadinessAsync(master.Id, EntityType.Article, master, price, ct);
    }

    private async Task<PortfolioReadiness> BuildPortfolioReadinessAsync(
        Guid jobId,
        EntityType candidateType,
        ImportJob? master,
        ImportJob? price,
        CancellationToken ct)
    {
        var masterArticles = master is null
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : (await repository.GetArticleNumbersForJobAsync(master.Id, ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var priceArticles = price is null
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : await GetReferencedArticleNumbersAsync(price.Id, ct);
        var articlesWithoutPrices = masterArticles
            .Where(article => !priceArticles.Contains(article))
            .OrderBy(article => article, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var pricesWithoutArticles = priceArticles
            .Where(article => !masterArticles.Contains(article))
            .OrderBy(article => article, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new PortfolioReadiness(
            jobId,
            candidateType,
            master?.Id,
            price?.Id,
            masterArticles.Count,
            priceArticles.Count,
            articlesWithoutPrices,
            pricesWithoutArticles);
    }

    private async Task<HashSet<string>> GetReferencedArticleNumbersAsync(Guid jobId, CancellationToken ct)
    {
        var rows = await repository.GetStagingRowsByJobAsync(jobId, ct);
        return rows
            .Select(row => GetArticleNumber(DeserializeFields(row.RawData)))
            .Where(article => !string.IsNullOrWhiteSpace(article))
            .Select(article => article!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static Task EnsurePortfolioIsConsistentAsync(PortfolioReadiness readiness, string action)
    {
        if (readiness.IsConsistent)
            return Task.CompletedTask;

        var problems = new List<string>();
        if (readiness.ArticlesWithoutPrices.Count > 0)
            problems.Add($"{readiness.ArticlesWithoutPrices.Count} article(s) would have no price");
        if (readiness.PricesWithoutArticles.Count > 0)
            problems.Add($"{readiness.PricesWithoutArticles.Count} price reference(s) would point to missing articles");
        throw new InvalidOperationException(
            $"This dataset cannot be {action}: {string.Join(" and ", problems)}. Create or update a coordinated release containing matching Article Master and Price List candidates.");
    }

    private async Task<ArticleMasterCandidateSummary> ToCandidateSummaryAsync(
        ImportJob candidate,
        ImportJob dependentJob,
        Guid? activeMasterId,
        string userId,
        CancellationToken ct)
    {
        var isWorkspace = candidate.WorkflowStage == ImportWorkflowStage.Private;
        var source = isWorkspace
            ? "Workspace"
            : candidate.WorkflowStage == ImportWorkflowStage.Published || candidate.Status == ImportStatus.Committed
                ? "Published"
                : "Review";
        var isOwnedWorkspace = isWorkspace
            && string.Equals(candidate.CreatedBy, userId, StringComparison.OrdinalIgnoreCase);
        var portfolioOnlyErrors = candidate.EntityType == EntityType.Article
            && await HasOnlyMissingPriceErrorsAsync(candidate, ct);
        var isEligible = (candidate.ErrorRows == 0 || portfolioOnlyErrors)
            && (isWorkspace
                ? isOwnedWorkspace
                    && (candidate.Status == ImportStatus.AwaitingApproval || portfolioOnlyErrors)
                    && !candidate.ReleasePackageId.HasValue
                : candidate.WorkflowStage is ImportWorkflowStage.Submitted
                    or ImportWorkflowStage.Approved
                    or ImportWorkflowStage.Published);
        var reason = isEligible
            ? null
            : candidate.ErrorRows > 0 && !portfolioOnlyErrors
                ? $"Contains {candidate.ErrorRows} blocking error row(s)."
                : candidate.ReleasePackageId.HasValue && isWorkspace
                    ? "Already belongs to another coordinated release."
                    : isWorkspace && !isOwnedWorkspace
                        ? "Private uploads are only available to their owner."
                        : "This upload is not ready to be used in a release.";
        var articleCount = (await repository.GetArticleNumbersForJobAsync(candidate.Id, ct)).Count;
        var impact = await BuildDependencyImpactAsync(dependentJob, candidate.Id, ct);

        return new ArticleMasterCandidateSummary(
            candidate.Id,
            candidate.OriginalFileName,
            candidate.CommittedAt.HasValue
                ? $"Published {candidate.CommittedAt:yyyy.MM.dd HH:mm}"
                : $"Uploaded {candidate.CreatedAt:yyyy.MM.dd HH:mm}",
            candidate.CreatedAt,
            candidate.CommittedAt,
            articleCount,
            activeMasterId == candidate.Id,
            source,
            candidate.CreatedByDisplayName,
            candidate.Status,
            candidate.WorkflowStage,
            candidate.ErrorRows,
            isEligible,
            !isWorkspace,
            reason,
            impact.ValidReferences,
            impact.MissingReferences);
    }

    private async Task<PriceListCandidateSummary> ToPriceListCandidateSummaryAsync(
        ImportJob candidate,
        ImportJob articleJob,
        Guid? activePriceId,
        string userId,
        CancellationToken ct)
    {
        var isWorkspace = candidate.WorkflowStage == ImportWorkflowStage.Private;
        var source = isWorkspace
            ? "Workspace"
            : candidate.WorkflowStage == ImportWorkflowStage.Published || candidate.Status == ImportStatus.Committed
                ? "Published"
                : "Review";
        var isOwnedWorkspace = isWorkspace
            && string.Equals(candidate.CreatedBy, userId, StringComparison.OrdinalIgnoreCase);
        var readiness = await BuildPortfolioReadinessAsync(
            articleJob.Id, EntityType.Article, articleJob, candidate, ct);
        var isEligible = isWorkspace
                ? isOwnedWorkspace
                    && !candidate.ReleasePackageId.HasValue
                : candidate.WorkflowStage is ImportWorkflowStage.Submitted
                    or ImportWorkflowStage.Approved
                    or ImportWorkflowStage.Published;
        var reason = isEligible
            ? null
            : candidate.ReleasePackageId.HasValue && isWorkspace
                    ? "Already belongs to another coordinated release."
                    : isWorkspace && !isOwnedWorkspace
                        ? "Private uploads are only available to their owner."
                        : "This upload is not ready to be used in a release.";
        var priceCount = (await GetReferencedArticleNumbersAsync(candidate.Id, ct)).Count;

        return new PriceListCandidateSummary(
            candidate.Id,
            candidate.OriginalFileName,
            candidate.CommittedAt.HasValue
                ? $"Published {candidate.CommittedAt:yyyy.MM.dd HH:mm}"
                : $"Uploaded {candidate.CreatedAt:yyyy.MM.dd HH:mm}",
            candidate.CreatedAt,
            candidate.CommittedAt,
            priceCount,
            activePriceId == candidate.Id,
            source,
            candidate.CreatedByDisplayName,
            candidate.Status,
            candidate.WorkflowStage,
            candidate.ErrorRows,
            isEligible,
            !isWorkspace,
            reason,
            Math.Max(0, readiness.MasterArticleCount - readiness.ArticlesWithoutPrices.Count),
            readiness.ArticlesWithoutPrices.Count,
            readiness.PricesWithoutArticles.Count);
    }

    private async Task<ValidationAnchorSummary> ToAnchorSummaryAsync(
        ImportJob job,
        Guid? activeMasterId,
        Guid? releasePackageId,
        CancellationToken ct)
    {
        var count = (await repository.GetArticleNumbersForJobAsync(job.Id, ct)).Count;
        return new ValidationAnchorSummary(
            job.Id,
            job.OriginalFileName,
            job.CommittedAt.HasValue ? $"Published {job.CommittedAt:yyyy.MM.dd HH:mm}" : $"Draft {job.CreatedAt:yyyy.MM.dd HH:mm}",
            job.CommittedAt,
            count,
            activeMasterId == job.Id,
            releasePackageId.HasValue && job.ReleasePackageId == releasePackageId);
    }

    private async Task<ImportJob> EnsureSelectableArticleMasterAsync(
        Guid articleMasterJobId,
        string userId,
        bool allowPrivateCandidate,
        CancellationToken ct)
    {
        var master = await repository.GetJobAsync(articleMasterJobId, ct)
            ?? throw new KeyNotFoundException($"Article Master upload '{articleMasterJobId}' not found.");
        if (master.EntityType != EntityType.Article)
            throw new InvalidOperationException("The selected validation anchor is not an Article Master upload.");
        if (master.Status == ImportStatus.Committed)
            return master;
        if (allowPrivateCandidate
            && master.WorkflowStage == ImportWorkflowStage.Private
            && string.Equals(master.CreatedBy, userId, StringComparison.OrdinalIgnoreCase)
            && (master.Status == ImportStatus.AwaitingApproval || await HasOnlyMissingPriceErrorsAsync(master, ct))
            && (master.ErrorRows == 0 || await HasOnlyMissingPriceErrorsAsync(master, ct)))
            return master;
        throw new InvalidOperationException("Select a published Article Master or an error-free private master candidate that you own.");
    }

    private async Task<ReleasePackage> GetOwnedDraftPackageAsync(Guid packageId, string userId, CancellationToken ct)
    {
        var package = await repository.GetReleasePackageAsync(packageId, ct)
            ?? throw new KeyNotFoundException($"Release package '{packageId}' not found.");
        if (!string.Equals(package.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Only the release owner can submit this package.");
        if (package.Status != ReleasePackageStatus.Draft)
            throw new InvalidOperationException("Only a draft release package can be submitted.");
        return package;
    }

    private static void ValidatePackageComposition(ReleasePackage package)
    {
        if (package.Jobs.Count < 2 || package.Jobs.Count(job => job.EntityType == EntityType.Article) != 1)
            throw new InvalidOperationException("A coordinated release requires exactly one Article Master and at least one dependent dataset.");
        var masterId = package.Jobs.Single(job => job.EntityType == EntityType.Article).Id;
        if (package.Jobs.Where(job => IsDependentDataset(job.EntityType))
            .Any(job => job.ValidationAnchorJobId != masterId || job.ValidationAnchorKind != ValidationAnchorKind.ReleaseCandidate))
            throw new InvalidOperationException("Every dependent dataset must be validated against the package Article Master.");
    }

    private static IEnumerable<ImportJob> PackageOrder(IEnumerable<ImportJob> jobs)
        => jobs.OrderBy(job => job.EntityType switch
        {
            EntityType.Article => 0,
            EntityType.Description => 1,
            EntityType.PriceList => 2,
            EntityType.CurrencyRate => 3,
            _ => 9
        });

    private static ReleasePackageSummary ToReleaseSummary(ReleasePackage package)
    {
        var masterId = package.Jobs.FirstOrDefault(job => job.EntityType == EntityType.Article)?.Id;
        return new ReleasePackageSummary(
            package.Id,
            package.Name,
            package.Status,
            package.CreatedBy,
            package.CreatedByDisplayName,
            package.CreatedAt,
            package.SubmittedAt,
            package.SubmittedByDisplayName,
            package.ApprovedAt,
            package.ApprovedByDisplayName,
            package.RejectedAt,
            package.RejectedByDisplayName,
            package.RejectionReason,
            package.PublishedAt,
            package.PublishedByDisplayName,
            package.FailureReason,
            PackageOrder(package.Jobs).Select(job => new ReleasePackageItemSummary(
                job.Id,
                job.EntityType,
                DatasetCatalog.Get(job.EntityType).DisplayName,
                job.OriginalFileName,
                job.Status,
                job.WorkflowStage,
                job.TotalRows,
                job.ErrorRows,
                job.Id == masterId)).ToList());
    }

    private static bool IsDependentDataset(EntityType entityType)
        => entityType is EntityType.PriceList or EntityType.Description;

    private static void EnsureDependentDataset(ImportJob job)
    {
        if (!IsDependentDataset(job.EntityType))
            throw new InvalidOperationException("Only prices and descriptions use an Article Master validation context.");
    }

    private static Dictionary<string, string?> DeserializeFields(string rawData)
        => string.IsNullOrWhiteSpace(rawData)
            ? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            : JsonSerializer.Deserialize<Dictionary<string, string?>>(rawData, JsonOpts)
              ?? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

    private static List<ValidationMessage> DeserializeMessages(string? rawMessages)
        => string.IsNullOrWhiteSpace(rawMessages)
            ? []
            : JsonSerializer.Deserialize<List<ValidationMessage>>(rawMessages, JsonOpts) ?? [];

    private void ApplyDuplicateArticleValidation(IReadOnlyCollection<ParsedRow> rows)
    {
        var rowData = rows
            .Select(row => new
            {
                Row = row,
                ArticleNumber = GetArticleNumber(row.Fields),
                DuplicateMessage = CreateDuplicateArticleMessage(GetArticleNumber(row.Fields))
            })
            .ToList();

        ApplyDuplicateValidation(rowData.Select(x => (x.Row.Fields, x.Row.Messages, x.ArticleNumber, x.DuplicateMessage)));
    }

    private void ApplyDuplicateArticleValidation(IReadOnlyCollection<StagingRow> rows)
    {
        var rowData = rows
            .Select(row =>
            {
                var fields = DeserializeFields(row.RawData);
                var messages = DeserializeMessages(row.ValidationMessages);
                var articleNumber = GetArticleNumber(fields);
                return new
                {
                    Row = row,
                    Fields = fields,
                    Messages = messages,
                    ArticleNumber = articleNumber,
                    DuplicateMessage = CreateDuplicateArticleMessage(articleNumber)
                };
            })
            .ToList();

        ApplyDuplicateValidation(rowData.Select(x => (x.Fields, x.Messages, x.ArticleNumber, x.DuplicateMessage)));

        foreach (var item in rowData)
        {
            item.Row.ValidationMessages = item.Messages.Count > 0
                ? JsonSerializer.Serialize(item.Messages, JsonOpts)
                : null;
            item.Row.Status = RowValidator.DeriveStatus(item.Messages);
        }
    }

    private async Task RevalidateDuplicateArticleRowsAsync(Guid jobId, CancellationToken ct)
    {
        var job = await repository.GetJobAsync(jobId, ct);
        if (job?.EntityType is not EntityType.Article and not EntityType.PriceList)
            return;
        var rows = await repository.GetStagingRowsByJobAsync(jobId, ct);
        ApplyDuplicateArticleValidation(rows);
        await repository.SaveChangesAsync(ct);
    }

    private static void ApplyDuplicateValidation(
        IEnumerable<(Dictionary<string, string?> Fields, List<ValidationMessage> Messages, string? ArticleNumber, string DuplicateMessage)> rowData)
    {
        var grouped = rowData
            .Where(x => !string.IsNullOrWhiteSpace(x.ArticleNumber))
            .GroupBy(x => x.ArticleNumber!, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var duplicateKeys = grouped
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var item in rowData)
        {
            item.Messages.RemoveAll(m =>
                m.Field.Equals("ArticleNumber", StringComparison.OrdinalIgnoreCase) &&
                m.Message.StartsWith("ArticleNumber value ", StringComparison.OrdinalIgnoreCase) &&
                m.Message.EndsWith("is duplicated within the uploaded file.", StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(item.ArticleNumber) && duplicateKeys.Contains(item.ArticleNumber!))
            {
                item.Messages.Add(new ValidationMessage
                {
                    Field = "ArticleNumber",
                    Message = item.DuplicateMessage,
                    Severity = ValidationSeverity.Error
                });
            }
        }
    }

    private static string? GetArticleNumber(IReadOnlyDictionary<string, string?> fields)
    {
        return fields.TryGetValue("ArticleNumber", out var articleNumber)
            ? articleNumber?.Trim()
            : null;
    }

    private static string CreateDuplicateArticleMessage(string? articleNumber)
        => $"ArticleNumber value '{articleNumber}' is duplicated within the uploaded file.";

    private IFileParser GetParser(EntityType entityType)
        => parsers.FirstOrDefault(parser => parser.SupportedEntityType == entityType)
           ?? throw new InvalidOperationException($"No parser found for dataset '{DatasetCatalog.Get(entityType).DisplayName}'.");

    private async Task<ImportJob> GetEditablePrivateJobAsync(Guid jobId, string userId, string action, CancellationToken ct)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");
        EnsurePrivateOwner(job, userId, action);
        if (job.Status is ImportStatus.Approved or ImportStatus.Committed or ImportStatus.Rejected or ImportStatus.Failed or ImportStatus.Cancelled)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be edited.");
        return job;
    }

    private async Task<List<StagingRow>> LoadRequestedRowsAsync(Guid jobId, IReadOnlyCollection<Guid> rowIds, CancellationToken ct)
    {
        var distinctIds = rowIds.Distinct().ToList();
        var rows = new List<StagingRow>(distinctIds.Count);
        foreach (var rowId in distinctIds)
        {
            var row = await repository.GetStagingRowAsync(jobId, rowId, ct)
                ?? throw new KeyNotFoundException($"Row '{rowId}' not found for import job '{jobId}'.");
            rows.Add(row);
        }
        return rows;
    }

    private static void EnsurePrivateOwner(ImportJob job, string userId, string action)
    {
        if (!string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException($"Only the original uploader can {action} this private upload.");
        if (job.WorkflowStage != ImportWorkflowStage.Private)
            throw new InvalidOperationException($"This upload is in the '{job.WorkflowStage}' workflow stage and cannot be {action}ed.");
    }

    private static string NormalizeUploadName(string requestedName, string currentName)
    {
        if (string.IsNullOrWhiteSpace(requestedName))
            throw new InvalidDataException("Provide a name for this upload.");

        var extension = Path.GetExtension(currentName);
        if (string.IsNullOrWhiteSpace(extension))
            throw new InvalidDataException("The upload's file type could not be determined.");

        var name = requestedName.Trim();
        if (Path.GetFileName(name) != name || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
            throw new InvalidDataException("The upload name contains invalid characters.");

        var requestedExtension = Path.GetExtension(name);
        if (string.Equals(requestedExtension, extension, StringComparison.OrdinalIgnoreCase))
        {
            name = Path.GetFileNameWithoutExtension(name).Trim();
        }
        else if (requestedExtension is not null
                 && new[] { ".xlsx", ".xls", ".csv" }.Contains(requestedExtension, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidDataException($"This upload must keep its '{extension}' file type.");
        }

        name = name.TrimEnd('.').Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidDataException("Provide a name for this upload.");

        var normalizedName = $"{name}{extension}";
        if (normalizedName.Length > 180)
            throw new InvalidDataException("The upload name must be at most 180 characters including its file type.");

        return normalizedName;
    }

    private static ImportComparisonResult DeserializeSubmittedComparison(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<ImportComparisonResult>(json, JsonOpts)
                ?? throw new InvalidDataException("The submitted comparison evidence is empty.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException("The submitted comparison evidence is invalid.", ex);
        }
    }

    private static void ApplyJobTotals(ImportJob job, IReadOnlyCollection<StagingRow> rows)
    {
        job.TotalRows = rows.Count;
        job.ValidRows = rows.Count(r => r.Status == RowStatus.Valid);
        job.WarningRows = rows.Count(r => r.Status == RowStatus.Warning);
        job.ErrorRows = rows.Count(r => r.Status == RowStatus.Error);
        job.Status = job.ErrorRows > 0 ? ImportStatus.NeedsCorrection : ImportStatus.AwaitingApproval;
        job.ProcessedAt = DateTime.UtcNow;
    }
}
