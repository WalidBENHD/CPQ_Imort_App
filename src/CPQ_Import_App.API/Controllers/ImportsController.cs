using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Mapping;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ImportsController(
    IImportService importService,
    INotificationService notificationService,
    IActivityService activityService,
    AppDbContext db) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? "unknown";

    private string UserDisplayName => User.FindFirstValue("name")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? UserId;

    /// <summary>Upload a file and create an import job.</summary>
    [HttpPost("upload")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    public async Task<ActionResult<ImportJobDto>> Upload(
        IFormFile file,
        [FromQuery] string entityType,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file provided.");

        if (!Enum.TryParse<EntityType>(entityType, ignoreCase: true, out var et) || et == EntityType.Unknown || !DatasetCatalog.IsSupported(et))
            return BadRequest($"Invalid dataset '{entityType}'. Valid datasets: {DatasetCatalog.GetValidDatasetList()}.");

        var allowedExtensions = new[] { ".xlsx", ".csv" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest($"File type '{ext}' is not supported. Use .xlsx or .csv.");

        await using var stream = file.OpenReadStream();
        try
        {
            var job = await importService.UploadAsync(stream, file.FileName, et, UserId, UserDisplayName, ct);
            
            if (job.Status == ImportStatus.AwaitingApproval)
            {
                // Notify approvers/admins about the new import
                var approverIds = await db.TestUsers
                    .AsNoTracking()
                    .Where(x => x.IsApproved && (x.IsAdmin || x.Role == "cpq-approver"))
                    .Select(x => x.Id)
                    .ToListAsync(ct);

                if (approverIds.Any())
                {
                    await notificationService.NotifyImportUploadedAsync(job, approverIds);
                }
            }
            else if (job.Status == ImportStatus.NeedsCorrection && Guid.TryParse(job.CreatedBy, out var uploaderId))
            {
                await notificationService.NotifyImportNeedsCorrectionAsync(job, uploaderId);
            }

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "UploadImport",
                $"Uploaded {job.OriginalFileName} for {job.EntityType}.",
                TargetType: "ImportJob",
                TargetId: job.Id.ToString(),
                StatusCode: StatusCodes.Status201Created,
                Metadata: new { job.EntityType, job.TotalRows, job.ValidRows, job.WarningRows, job.ErrorRows }),
                ct);

            return CreatedAtAction(nameof(GetJob), new { id = job.Id }, job.ToDto());
        }
        catch (InvalidDataException ex)
        {
            return UnprocessableEntity(new { error = ex.Message });
        }
    }

    /// <summary>Get a single import job.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ImportJobDto>> GetJob(Guid id, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(id, ct);
        return job is null ? NotFound() : Ok(job.ToDto());
    }

    /// <summary>Get a comparison summary between the upload and the current baseline.</summary>
    [HttpGet("{id:guid}/comparison")]
    public async Task<ActionResult<ImportComparisonDto>> GetComparison(Guid id, CancellationToken ct)
    {
        try
        {
            var comparison = await importService.GetComparisonAsync(id, ct);
            return Ok(comparison.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    /// <summary>Get paginated list of import jobs.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ImportJobDto>>> GetJobs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? entityType = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        ImportStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ImportStatus>(status, ignoreCase: true, out var st))
            parsedStatus = st;

        EntityType? parsedEntityType = null;
        if (!string.IsNullOrWhiteSpace(entityType) && Enum.TryParse<EntityType>(entityType, ignoreCase: true, out var et) && et != EntityType.Unknown && DatasetCatalog.IsSupported(et))
            parsedEntityType = et;

        var (items, total) = await importService.GetJobsPagedAsync(page, pageSize, search, parsedStatus, parsedEntityType, ct);
        return Ok(new PagedResult<ImportJobDto>(items.Select(j => j.ToDto()).ToList(), total, page, pageSize));
    }

    /// <summary>Get the staging rows (preview) for a job.</summary>
    [HttpGet("{id:guid}/rows")]
    public async Task<ActionResult<PagedResult<StagingRowDto>>> GetRows(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? comparisonStatus = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;

        RowStatus? filterStatus = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<RowStatus>(status, ignoreCase: true, out var rs))
            filterStatus = rs;

        ComparisonStatus? parsedComparisonStatus = null;
        if (!string.IsNullOrWhiteSpace(comparisonStatus) && Enum.TryParse<ComparisonStatus>(comparisonStatus, ignoreCase: true, out var cs))
            parsedComparisonStatus = cs;

        var (items, total) = await importService.GetStagingRowsAsync(id, page, pageSize, search, filterStatus, parsedComparisonStatus, ct);
        return Ok(new PagedResult<StagingRowDto>(items.Select(r => r.ToDto()).ToList(), total, page, pageSize));
    }

    /// <summary>Commit a job — role: cpq-approver required.</summary>
    /// <summary>Update a staging row during correction mode.</summary>
    [HttpPut("{jobId:guid}/rows/{rowId:guid}")]
    public async Task<ActionResult<ImportJobDto>> UpdateRow(
        Guid jobId,
        Guid rowId,
        [FromBody] UpdateRowRequest request,
        CancellationToken ct)
    {
        if (request.Fields is null || request.Fields.Count == 0)
            return BadRequest("At least one field must be provided.");

        var job = await importService.GetJobAsync(jobId, ct);
        if (job is null)
            return NotFound(new { error = $"Import job '{jobId}' not found." });

        if (!string.Equals(job.CreatedBy, UserId, StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the original uploader can correct this import." });
        }

        try
        {
            await importService.UpdateStagingRowAsync(jobId, rowId, request.Fields, UserId, UserDisplayName, ct);
            var updated = await importService.GetJobAsync(jobId, ct);

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "UpdateRow",
                $"Updated row {rowId} for import {jobId}.",
                TargetType: "ImportJob",
                TargetId: jobId.ToString(),
                StatusCode: StatusCodes.Status200OK,
                Metadata: new { RowId = rowId, FieldCount = request.Fields.Count }),
                ct);

            return Ok(updated!.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Row update failed: {ex.GetBaseException().Message}" });
        }
    }

    /// <summary>Cancel a submission so the uploader can correct the source file and re-upload.</summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<ImportJobDto>> Cancel(Guid id, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(id, ct);
        if (job is null)
            return NotFound(new { error = $"Import job '{id}' not found." });

        if (!string.Equals(job.CreatedBy, UserId, StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the original uploader can cancel this import." });
        }

        try
        {
            var cancelled = await importService.CancelAsync(id, UserId, UserDisplayName, ct);

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "CancelImport",
                $"Cancelled import {id}.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK),
                ct);

            return Ok(cancelled.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Cancellation failed: {ex.GetBaseException().Message}" });
        }
    }

    [HttpPost("{id:guid}/commit")]
    [Authorize]
    public async Task<ActionResult<CommitResultDto>> Commit(Guid id, CancellationToken ct)
    {
        var permissionError = await ValidateApproverPermissionAsync(ct);
        if (permissionError is not null)
        {
            return permissionError;
        }

        try
        {
            var job = await importService.CommitAsync(id, UserId, UserDisplayName, ct);
            
            // Notify the uploader that their import was committed
            if (Guid.TryParse(job.CreatedBy, out var uploaderId))
            {
                await notificationService.NotifyImportCommittedAsync(job, uploaderId);
            }

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "CommitImport",
                $"Committed import {id} with {job.CommittedRows} rows.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK,
                Metadata: new { job.CommittedRows }),
                ct);
            
            return Ok(new CommitResultDto(job.Id, job.CommittedRows, $"Successfully committed {job.CommittedRows} rows."));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Commit failed: {ex.GetBaseException().Message}" });
        }
    }

    /// <summary>Reject a job — role: cpq-approver required.</summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize]
    public async Task<ActionResult<ImportJobDto>> Reject(Guid id, [FromBody] RejectRequest request, CancellationToken ct)
    {
        var permissionError = await ValidateApproverPermissionAsync(ct);
        if (permissionError is not null)
        {
            return permissionError;
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest("A rejection reason is required.");
        try
        {
            var job = await importService.RejectAsync(id, UserId, UserDisplayName, request.Reason, ct);
            
            // Notify the uploader that their import was rejected
            if (Guid.TryParse(job.CreatedBy, out var uploaderId))
            {
                await notificationService.NotifyImportRejectedAsync(job, uploaderId);
            }

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "RejectImport",
                $"Rejected import {id}.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK,
                Metadata: new { request.Reason }),
                ct);
            
            return Ok(job.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Reject failed: {ex.GetBaseException().Message}" });
        }
    }

    /// <summary>Download the original uploaded file.</summary>
    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> DownloadOriginal(Guid id, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(id, ct);
        if (job is null) return NotFound();
        var bytes = await importService.GetOriginalFileAsync(id, ct);
        if (bytes is null) return NotFound();
        return File(bytes, "application/octet-stream", job.OriginalFileName);
    }

    /// <summary>Download an Excel error report for a job.</summary>
    [HttpGet("{id:guid}/error-report")]
    public async Task<IActionResult> DownloadErrorReport(Guid id, CancellationToken ct)
    {
        try
        {
            var bytes = await importService.GenerateErrorReportAsync(id, ct);
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"errors_{id:N}.xlsx");
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    private async Task<ActionResult?> ValidateApproverPermissionAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(UserId, out var currentUserId))
        {
            return Unauthorized(new { error = "Invalid user identity." });
        }

        var currentUser = await db.TestUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == currentUserId, ct);

        if (currentUser is null || !currentUser.IsApproved)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Your account is not approved to perform this action." });
        }

        if (!currentUser.IsAdmin && !string.Equals(currentUser.Role, "cpq-approver", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Approver role is required. Sign out and sign in again after role changes." });
        }

        return null;
    }
}
