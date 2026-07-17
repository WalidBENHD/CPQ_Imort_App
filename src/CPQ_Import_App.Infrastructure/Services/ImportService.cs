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

    public async Task<ImportJob> UploadAsync(Stream fileStream, string fileName, EntityType entityType,
        string userId, string userDisplayName, CancellationToken ct = default)
    {
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

        // Find parser
        var parser = parsers.FirstOrDefault(p => p.CanParse(fileName, entityType))
            ?? throw new InvalidOperationException($"No parser found for dataset '{DatasetCatalog.Get(entityType).DisplayName}'.");

        List<StagingRow> stagingRows;
        try
        {
            ms.Position = 0;
            var parsed = await parser.ParseAsync(ms, fileName, ct);
            IReadOnlySet<string>? approvedArticles = null;
        if (entityType == EntityType.PriceList)
        {
            approvedArticles = await repository.GetLatestApprovedArticleNumbersAsync(ct);
        }

        foreach (var row in parsed)
        {
            await ApplyCurrentBaselineValidationAsync(entityType, row.Fields, row.Messages, approvedArticles, ct);
        }

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
        => repository.GetJobAsync(jobId, ct);

    public Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(
        int page, int pageSize, string viewerUserId, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default)
        => repository.GetJobsPagedAsync(page, pageSize, viewerUserId, search, status, entityType, ct);

    public Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsAsync(
        Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null, ComparisonStatus? comparisonStatus = null, CancellationToken ct = default)
        => repository.GetStagingRowsPagedAsync(jobId, page, pageSize, search, filterStatus, comparisonStatus, ct);

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
        if (job.EntityType == EntityType.PriceList)
        {
            approvedArticles = await repository.GetLatestApprovedArticleNumbersAsync(ct);
        }

        foreach (var row in rows)
        {
            var fields = DeserializeFields(row.RawData);
            var messages = parser.ValidateRow(fields);
            await ApplyCurrentBaselineValidationAsync(job.EntityType, fields, messages, approvedArticles, ct);

            row.RawData = JsonSerializer.Serialize(fields, JsonOpts);
            row.ValidationMessages = messages.Count > 0
                ? JsonSerializer.Serialize(messages, JsonOpts)
                : null;
            row.Status = RowValidator.DeriveStatus(messages);
        }

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
        await ApplyCurrentBaselineValidationAsync(job.EntityType, fields, messages, null, ct);
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
        await ApplyCurrentBaselineValidationAsync(job.EntityType, fields, messages, null, ct);

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
        Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        EnsurePrivateOwner(job, userId, "submit");
        if (job.Status != ImportStatus.AwaitingApproval || job.ErrorRows > 0)
            throw new InvalidOperationException("Blocking errors must be corrected before this upload can be submitted.");
        if (job.TotalRows == 0)
            throw new InvalidOperationException("A draft with no active rows cannot be submitted for review.");

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

    public async Task<ImportJob> WithdrawFromReviewAsync(
        Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (!string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Only the original uploader can withdraw this submission.");
        if (job.WorkflowStage != ImportWorkflowStage.Submitted || job.Status != ImportStatus.AwaitingApproval)
            throw new InvalidOperationException("Only a submission currently waiting for review can be withdrawn.");

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

    public async Task DeletePrivateDraftAsync(Guid jobId, string userId, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");
        EnsurePrivateOwner(job, userId, "delete");
        await repository.DeleteJobAsync(job, ct);
    }

    public async Task<ImportJob> ApproveAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status != ImportStatus.AwaitingApproval)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be approved.");

        if (job.WorkflowStage != ImportWorkflowStage.Submitted)
            throw new InvalidOperationException("The uploader must submit this private upload before it can be approved.");

        if (string.Equals(job.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("You cannot approve your own submission.");

        if (job.ErrorRows > 0)
            throw new InvalidOperationException("Blocking errors must be corrected before approval.");

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

    public async Task<ImportJob> PublishAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status != ImportStatus.Approved)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be published.");

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
        CancellationToken ct)
    {
        if (entityType != EntityType.PriceList)
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
            Message = $"Article '{articleNumber}' does not exist in the approved Article Master baseline.",
            Severity = ValidationSeverity.Error
        });
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
