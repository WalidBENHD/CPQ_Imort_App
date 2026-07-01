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

namespace CPQ_Import_App.Infrastructure.Services;

public class ImportService(
    IImportRepository repository,
    IEnumerable<IFileParser> parsers,
    IEnumerable<ICpqCommitStrategy> commitStrategies) : IImportService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = false };

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
            stagingRows = parsed.Select(r => new StagingRow
            {
                ImportJobId = job.Id,
                RowNumber = r.RowNumber,
                Status = r.Status,
                RawData = JsonSerializer.Serialize(r.Fields, JsonOpts),
                ValidationMessages = r.Messages.Count > 0
                    ? JsonSerializer.Serialize(r.Messages, JsonOpts)
                    : null
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
        int page, int pageSize, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default)
        => repository.GetJobsPagedAsync(page, pageSize, search, status, entityType, ct);

    public Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsAsync(
        Guid jobId, int page, int pageSize, RowStatus? filterStatus = null, CancellationToken ct = default)
        => repository.GetStagingRowsPagedAsync(jobId, page, pageSize, filterStatus, ct);

    public async Task<StagingRow> UpdateStagingRowAsync(
        Guid jobId, Guid rowId, Dictionary<string, string?> fields, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status is ImportStatus.Committed or ImportStatus.Rejected or ImportStatus.Failed or ImportStatus.Cancelled)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be edited.");

        var row = await repository.GetStagingRowAsync(jobId, rowId, ct)
            ?? throw new KeyNotFoundException($"Row '{rowId}' not found for import job '{jobId}'.");

        var parser = parsers.FirstOrDefault(p => p.SupportedEntityType == job.EntityType)
            ?? throw new InvalidOperationException($"No parser found for dataset '{DatasetCatalog.Get(job.EntityType).DisplayName}'.");

        var messages = parser.ValidateRow(fields);
        row.RawData = JsonSerializer.Serialize(fields, JsonOpts);
        row.ValidationMessages = messages.Count > 0 ? JsonSerializer.Serialize(messages, JsonOpts) : null;
        row.Status = RowValidator.DeriveStatus(messages);

        await repository.UpdateStagingRowAsync(row, ct);

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

    public async Task<ImportJob> CommitAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status != ImportStatus.AwaitingApproval)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be committed.");

        if (job.ErrorRows > 0)
            throw new InvalidOperationException("Blocking errors must be corrected before commit.");

        var strategy = commitStrategies.FirstOrDefault(s => s.EntityType == job.EntityType)
            ?? throw new InvalidOperationException($"No commit strategy for dataset '{DatasetCatalog.Get(job.EntityType).DisplayName}'.");

        // Retrieve all valid + warning rows
        var allRows = new List<StagingRow>();
        int page = 1;
        while (true)
        {
            var (items, total) = await repository.GetStagingRowsPagedAsync(jobId, page, 500, null, ct);
            allRows.AddRange(items.Where(r => r.Status != RowStatus.Error));
            if (allRows.Count >= total || items.Count == 0) break;
            page++;
        }

        var rowDicts = allRows
            .Select(r => JsonSerializer.Deserialize<Dictionary<string, string?>>(r.RawData, JsonOpts)!)
            .ToList();

        await strategy.CommitRowsAsync(rowDicts, ct);

        job.Status = ImportStatus.Committed;
        job.CommittedAt = DateTime.UtcNow;
        job.CommittedBy = userDisplayName;
        job.CommittedRows = rowDicts.Count;

        await repository.UpdateJobAsync(job, ct);
        await repository.AddAuditLogAsync(new AuditLog
        {
            ImportJobId = job.Id,
            Action = "Committed",
            PerformedBy = userId,
            PerformedByDisplayName = userDisplayName,
            Details = $"Committed {job.CommittedRows} rows."
        }, ct);

        return job;
    }

    public async Task<ImportJob> CancelAsync(Guid jobId, string userId, string userDisplayName, CancellationToken ct = default)
    {
        var job = await repository.GetJobAsync(jobId, ct)
            ?? throw new KeyNotFoundException($"Import job '{jobId}' not found.");

        if (job.Status is ImportStatus.Committed or ImportStatus.Rejected or ImportStatus.Failed or ImportStatus.Cancelled)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be cancelled.");

        if (job.Status is not ImportStatus.AwaitingApproval and not ImportStatus.NeedsCorrection and not ImportStatus.Processing)
            throw new InvalidOperationException($"Job is in status '{job.Status}' and cannot be cancelled.");

        job.Status = ImportStatus.Cancelled;
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

        job.Status = ImportStatus.Rejected;
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

    public Task<byte[]?> GetOriginalFileAsync(Guid jobId, CancellationToken ct = default)
        => repository.GetUploadedFileAsync(jobId, ct);

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
            var (items, total) = await repository.GetStagingRowsPagedAsync(jobId, page, 500, RowStatus.Error, ct);
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

    private async Task RecalculateJobAsync(ImportJob job, CancellationToken ct)
    {
        var allRows = new List<StagingRow>();
        int page = 1;
        while (true)
        {
            var (items, total) = await repository.GetStagingRowsPagedAsync(job.Id, page, 500, null, ct);
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
}
