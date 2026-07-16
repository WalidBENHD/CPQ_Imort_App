using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Mapping;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.Infrastructure.Services;
using CPQ_Import_App.API.Security;
using CPQ_Import_App.Core.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Capabilities.ImportsView)]
public class ImportsController(
    IImportService importService,
    INotificationService notificationService,
    IActivityService activityService,
    AccessControlService accessControlService) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? "unknown";

    private string UserDisplayName => User.FindFirstValue("name")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? UserId;

    /// <summary>Upload a file and create an import job.</summary>
    [HttpPost("upload")]
    [Authorize(Policy = Capabilities.ImportsUpload)]
    [Authorize(Policy = Capabilities.ImportsSubmit)]
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
                var approverIds = await accessControlService.GetUserIdsWithCapabilityAsync(Capabilities.ImportsApprove, ct);

                if (approverIds.Any())
                {
                    await notificationService.NotifyImportUploadedAsync(job, approverIds.ToList());
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

    /// <summary>Get the immutable comparison accepted at approval, before or after publication.</summary>
    [HttpGet("{id:guid}/approval-snapshot")]
    public async Task<ActionResult<ApprovedComparisonSnapshotDto>> GetApprovalSnapshot(Guid id, CancellationToken ct)
    {
        try
        {
            var snapshot = await importService.GetApprovedComparisonSnapshotAsync(id, ct);
            return snapshot is null ? NoContent() : Ok(snapshot.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidDataException ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
    }

    /// <summary>Refresh row validation against the latest approved master data.</summary>
    [HttpPost("{id:guid}/refresh-validation")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<ImportJobDto>> RefreshValidation(Guid id, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(id, ct);
        if (job is null)
            return NotFound(new { error = $"Import job '{id}' not found." });

        if (!string.Equals(job.CreatedBy, UserId, StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the original uploader can refresh this import." });

        if (job.Status is ImportStatus.Approved or ImportStatus.Committed or ImportStatus.Rejected or ImportStatus.Failed or ImportStatus.Cancelled)
        {
            return Conflict(new { error = $"Job is in status '{job.Status}' and cannot be refreshed." });
        }

        try
        {
            var refreshed = await importService.RefreshValidationAsync(id, UserId, UserDisplayName, ct);

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "RefreshValidation",
                $"Refreshed validation for import {id}.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK),
                ct);

            return Ok(refreshed.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Validation refresh failed: {ex.GetBaseException().Message}" });
        }
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
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
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
    [Authorize(Policy = Capabilities.ImportsWithdrawOwn)]
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

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = Capabilities.ImportsApprove)]
    public async Task<ActionResult<ImportJobDto>> Approve(Guid id, CancellationToken ct)
    {
        try
        {
            var job = await importService.ApproveAsync(id, UserId, UserDisplayName, ct);

            if (Guid.TryParse(job.CreatedBy, out var uploaderId))
            {
                await notificationService.NotifyImportApprovedAsync(job, uploaderId);
            }

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "ApproveImport",
                $"Approved import {id} for publication.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK,
                Metadata: new { job.ApprovedAt, job.ApprovedByDisplayName }),
                ct);

            return Ok(job.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Approval failed: {ex.GetBaseException().Message}" });
        }
    }

    [HttpPost("{id:guid}/return-to-review")]
    [Authorize(Policy = Capabilities.ImportsReturnToReview)]
    public async Task<ActionResult<ImportJobDto>> ReturnToReview(Guid id, CancellationToken ct)
    {
        try
        {
            var job = await importService.ReturnToReviewAsync(id, UserId, UserDisplayName, ct);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "ReturnImportToReview",
                $"Returned approved import {id} to review.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK),
                ct);

            return Ok(job.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Return to review failed: {ex.GetBaseException().Message}" });
        }
    }

    [HttpPost("{id:guid}/publish")]
    [Authorize(Policy = Capabilities.ImportsPublish)]
    public async Task<ActionResult<PublicationResultDto>> Publish(Guid id, CancellationToken ct)
    {
        try
        {
            var job = await importService.PublishAsync(id, UserId, UserDisplayName, ct);

            if (Guid.TryParse(job.CreatedBy, out var uploaderId))
            {
                await notificationService.NotifyImportCommittedAsync(job, uploaderId);
            }

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "PublishImport",
                $"Published import {id} to CPQ with {job.CommittedRows} rows.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK,
                Metadata: new { PublishedRows = job.CommittedRows, job.ApprovedAt, job.ApprovedByDisplayName }),
                ct);

            return Ok(new PublicationResultDto(job.Id, job.CommittedRows, $"Successfully published {job.CommittedRows} rows to CPQ."));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (InvalidDataException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Publication failed: {ex.GetBaseException().Message}" });
        }
    }

    /// <summary>Reject a job — role: cpq-approver required.</summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = Capabilities.ImportsReject)]
    public async Task<ActionResult<ImportJobDto>> Reject(Guid id, [FromBody] RejectRequest request, CancellationToken ct)
    {
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

    /// <summary>Download a comparison report for rows with differences against the latest baseline.</summary>
    [HttpGet("{id:guid}/comparison-report")]
    public async Task<IActionResult> DownloadComparisonReport(Guid id, CancellationToken ct)
    {
        try
        {
            var bytes = await importService.GenerateComparisonReportAsync(id, ct);
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"comparison_{id:N}.xlsx");
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

}
