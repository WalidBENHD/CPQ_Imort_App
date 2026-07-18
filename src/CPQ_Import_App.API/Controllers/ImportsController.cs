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
            
            if (job.Status == ImportStatus.NeedsCorrection && Guid.TryParse(job.CreatedBy, out var uploaderId))
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
        return job is null || !CanView(job) ? NotFound() : Ok(job.ToDto());
    }

    /// <summary>Create an independent private draft from a shared or historical upload.</summary>
    [HttpPost("{id:guid}/copy-to-workspace")]
    [Authorize(Policy = Capabilities.ImportsUpload)]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<ImportJobDto>> CopyToWorkspace(
        Guid id,
        [FromBody] CopyToWorkspaceRequest request,
        CancellationToken ct)
    {
        try
        {
            var copy = await importService.CopyToWorkspaceAsync(id, request.FileName, UserId, UserDisplayName, ct);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "CopyImportToWorkspace",
                $"Created private working copy {copy.OriginalFileName} from import {id}.",
                TargetType: "ImportJob",
                TargetId: copy.Id.ToString(),
                StatusCode: StatusCodes.Status201Created,
                Metadata: new { SourceJobId = id, copy.EntityType, copy.TotalRows }), ct);
            return CreatedAtAction(nameof(GetJob), new { id = copy.Id }, copy.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidDataException ex) { return BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Get a comparison summary between the upload and the current baseline.</summary>
    [HttpGet("{id:guid}/comparison")]
    public async Task<ActionResult<ImportComparisonDto>> GetComparison(Guid id, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(id, ct);
        if (job is null || !CanView(job)) return NotFound();
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
        var job = await importService.GetJobAsync(id, ct);
        if (job is null || !CanView(job)) return NotFound();
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

        var (items, total) = await importService.GetJobsPagedAsync(page, pageSize, UserId, search, parsedStatus, parsedEntityType, ct);
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
        var job = await importService.GetJobAsync(id, ct);
        if (job is null || !CanView(job)) return NotFound();

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

    /// <summary>Freeze a private upload and share it with the review queue.</summary>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = Capabilities.ImportsSubmit)]
    public async Task<ActionResult<ImportJobDto>> Submit(Guid id, CancellationToken ct)
    {
        try
        {
            var submitted = await importService.SubmitForReviewAsync(id, UserId, UserDisplayName, ct);
            var approverIds = await accessControlService.GetUserIdsWithCapabilityAsync(Capabilities.ImportsApprove, ct);
            var recipients = approverIds.Where(userId => userId.ToString() != UserId).ToList();
            if (recipients.Count > 0)
                await notificationService.NotifyImportUploadedAsync(submitted, recipients);

            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "SubmitImport",
                $"Submitted {submitted.OriginalFileName} for team review.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK), ct);

            return Ok(submitted.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpGet("{id:guid}/dependency-context")]
    public async Task<ActionResult<DependencyContextDto>> GetDependencyContext(Guid id, CancellationToken ct)
    {
        try
        {
            var context = await importService.GetDependencyContextAsync(id, UserId, ct);
            return Ok(context.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
    }

    [HttpPost("{id:guid}/dependency-context/preview")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<DependencyImpactDto>> PreviewDependencyAnchor(
        Guid id, [FromBody] ApplyValidationAnchorRequest request, CancellationToken ct)
    {
        try
        {
            var impact = await importService.PreviewDependencyAnchorAsync(id, request.ArticleMasterJobId, UserId, ct);
            return Ok(impact.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("{id:guid}/dependency-context/apply")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<ImportJobDto>> ApplyDependencyAnchor(
        Guid id, [FromBody] ApplyValidationAnchorRequest request, CancellationToken ct)
    {
        try
        {
            var job = await importService.ApplyDependencyAnchorAsync(id, request.ArticleMasterJobId, UserId, UserDisplayName, ct);
            return Ok(job.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("{id:guid}/release-package")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<ReleasePackageDto>> CreateReleasePackage(
        Guid id, [FromBody] CreateReleasePackageRequest request, CancellationToken ct)
    {
        try
        {
            var package = await importService.CreateReleasePackageAsync(
                id, request.ArticleMasterJobId, request.Name, UserId, UserDisplayName, ct);
            return CreatedAtAction(nameof(GetReleasePackage), new { packageId = package.Id }, package.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidDataException ex) { return BadRequest(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpGet("release-packages/{packageId:guid}")]
    public async Task<ActionResult<ReleasePackageDto>> GetReleasePackage(Guid packageId, CancellationToken ct)
    {
        try
        {
            var canReview = User.Claims.Any(claim => claim.Value is Capabilities.ImportsApprove or Capabilities.ImportsPublish);
            return Ok((await importService.GetReleasePackageAsync(packageId, UserId, canReview, ct)).ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
    }

    [HttpPost("release-packages/{packageId:guid}/submit")]
    [Authorize(Policy = Capabilities.ImportsSubmit)]
    public async Task<ActionResult<ReleasePackageDto>> SubmitReleasePackage(Guid packageId, CancellationToken ct)
    {
        try
        {
            var package = await importService.SubmitReleasePackageAsync(packageId, UserId, UserDisplayName, ct);
            var representative = await importService.GetJobAsync(package.Items.First().JobId, ct);
            if (representative is not null)
            {
                var approverIds = await accessControlService.GetUserIdsWithCapabilityAsync(Capabilities.ImportsApprove, ct);
                await notificationService.NotifyImportUploadedAsync(representative, approverIds.Where(id => id.ToString() != UserId).ToList());
            }
            await activityService.LogAsync(new ActivityWriteRequest(ActivityCategory.Import, "SubmitReleasePackage",
                $"Submitted release package '{package.Name}' with {package.Items.Count} datasets.",
                TargetType: "ReleasePackage", TargetId: package.Id.ToString(), StatusCode: StatusCodes.Status200OK), ct);
            return Ok(package.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpDelete("release-packages/{packageId:guid}")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<IActionResult> DissolveReleasePackage(Guid packageId, CancellationToken ct)
    {
        try
        {
            await importService.DissolveReleasePackageAsync(packageId, UserId, UserDisplayName, ct);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "DissolveReleasePackage",
                $"Dissolved private release package {packageId}. Its uploads returned to the owner's workspace.",
                TargetType: "ReleasePackage",
                TargetId: packageId.ToString(),
                StatusCode: StatusCodes.Status204NoContent), ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("release-packages/{packageId:guid}/approve")]
    [Authorize(Policy = Capabilities.ImportsApprove)]
    public async Task<ActionResult<ReleasePackageDto>> ApproveReleasePackage(Guid packageId, CancellationToken ct)
    {
        try
        {
            var package = await importService.ApproveReleasePackageAsync(packageId, UserId, UserDisplayName, ct);
            var representative = await importService.GetJobAsync(package.Items.First().JobId, ct);
            if (representative is not null && Guid.TryParse(package.CreatedBy, out var ownerId))
                await notificationService.NotifyImportApprovedAsync(representative, ownerId);
            await activityService.LogAsync(new ActivityWriteRequest(ActivityCategory.Import, "ApproveReleasePackage",
                $"Approved release package '{package.Name}' with immutable evidence.",
                TargetType: "ReleasePackage", TargetId: package.Id.ToString(), StatusCode: StatusCodes.Status200OK), ct);
            return Ok(package.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("release-packages/{packageId:guid}/publish")]
    [Authorize(Policy = Capabilities.ImportsPublish)]
    public async Task<ActionResult<ReleasePackageDto>> PublishReleasePackage(Guid packageId, CancellationToken ct)
    {
        try
        {
            var package = await importService.PublishReleasePackageAsync(packageId, UserId, UserDisplayName, ct);
            var representative = await importService.GetJobAsync(package.Items.First().JobId, ct);
            if (representative is not null && Guid.TryParse(package.CreatedBy, out var ownerId))
                await notificationService.NotifyImportCommittedAsync(representative, ownerId);
            await activityService.LogAsync(new ActivityWriteRequest(ActivityCategory.Import, "PublishReleasePackage",
                $"Published release package '{package.Name}' in dependency order.",
                TargetType: "ReleasePackage", TargetId: package.Id.ToString(), StatusCode: StatusCodes.Status200OK), ct);
            return Ok(package.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (InvalidDataException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Return an unpublished submission to its owner's private workspace.</summary>
    [HttpPost("{id:guid}/withdraw")]
    [Authorize(Policy = Capabilities.ImportsWithdrawOwn)]
    public async Task<ActionResult<ImportJobDto>> Withdraw(Guid id, CancellationToken ct)
    {
        try
        {
            var withdrawn = await importService.WithdrawFromReviewAsync(id, UserId, UserDisplayName, ct);
            await notificationService.ClearImportNotificationsAsync(id);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "WithdrawImport",
                $"Withdrew {withdrawn.OriginalFileName} from team review.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status200OK), ct);
            return Ok(withdrawn.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Permanently delete a private draft and its staged data.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Capabilities.ImportsWithdrawOwn)]
    public async Task<IActionResult> DeletePrivateDraft(Guid id, CancellationToken ct)
    {
        try
        {
            await importService.DeletePrivateDraftAsync(id, UserId, UserDisplayName, ct);
            await notificationService.ClearImportNotificationsAsync(id);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import,
                "DeletePrivateImport",
                $"Permanently deleted private import {id}.",
                TargetType: "ImportJob",
                TargetId: id.ToString(),
                StatusCode: StatusCodes.Status204NoContent), ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Cancel a legacy submission so the uploader can upload a corrected file.</summary>
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
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = $"Approval failed: {ex.GetBaseException().Message}" });
        }
    }

    /// <summary>Create a row directly in an owned private draft.</summary>
    [HttpPost("{jobId:guid}/rows")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<ImportJobDto>> AddRow(Guid jobId, [FromBody] AddRowRequest request, CancellationToken ct)
    {
        if (request.Fields is null || request.Fields.Count == 0)
            return BadRequest(new { error = "At least one field must be provided." });
        try
        {
            var updated = await importService.AddStagingRowAsync(jobId, request.Fields, UserId, UserDisplayName, ct);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import, "AddDraftRow", $"Added a row to private import {jobId}.",
                TargetType: "ImportJob", TargetId: jobId.ToString(), StatusCode: StatusCodes.Status200OK,
                Metadata: new { FieldCount = request.Fields.Count }), ct);
            return Ok(updated.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Soft-delete selected rows from an owned private draft.</summary>
    [HttpPost("{jobId:guid}/rows/delete")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<ImportJobDto>> DeleteRows(Guid jobId, [FromBody] BulkRowRequest request, CancellationToken ct)
    {
        try
        {
            var updated = await importService.DeleteStagingRowsAsync(jobId, request.RowIds, UserId, UserDisplayName, ct);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import, "DeleteDraftRows", $"Removed {request.RowIds.Count} row(s) from private import {jobId}.",
                TargetType: "ImportJob", TargetId: jobId.ToString(), StatusCode: StatusCodes.Status200OK,
                Metadata: new { RowIds = request.RowIds }), ct);
            return Ok(updated.ToDto());
        }
        catch (InvalidDataException ex) { return BadRequest(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Restore selected soft-deleted rows to an owned private draft.</summary>
    [HttpPost("{jobId:guid}/rows/restore")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<ImportJobDto>> RestoreRows(Guid jobId, [FromBody] BulkRowRequest request, CancellationToken ct)
    {
        try
        {
            var updated = await importService.RestoreStagingRowsAsync(jobId, request.RowIds, UserId, UserDisplayName, ct);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import, "RestoreDraftRows", $"Restored {request.RowIds.Count} row(s) in private import {jobId}.",
                TargetType: "ImportJob", TargetId: jobId.ToString(), StatusCode: StatusCodes.Status200OK,
                Metadata: new { RowIds = request.RowIds }), ct);
            return Ok(updated.ToDto());
        }
        catch (InvalidDataException ex) { return BadRequest(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>List rows removed from an owned private draft so they can be restored.</summary>
    [HttpGet("{jobId:guid}/rows/removed")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<ActionResult<IReadOnlyList<StagingRowDto>>> GetRemovedRows(Guid jobId, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(jobId, ct);
        if (job is null || !CanView(job)) return NotFound();
        if (!string.Equals(job.CreatedBy, UserId, StringComparison.OrdinalIgnoreCase) || job.WorkflowStage != ImportWorkflowStage.Private)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Removed rows are only available to the owner of a private draft." });
        var rows = await importService.GetDeletedStagingRowsAsync(jobId, ct);
        return Ok(rows.Select(row => row.ToDto()).ToList());
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
        if (job is null || !CanView(job)) return NotFound();
        var bytes = await importService.GetOriginalFileAsync(id, ct);
        if (bytes is null) return NotFound();
        return File(bytes, "application/octet-stream", job.OriginalFileName);
    }

    /// <summary>Download the current private working copy with all draft edits applied.</summary>
    [HttpGet("{id:guid}/working-copy")]
    [Authorize(Policy = Capabilities.ImportsCorrectOwn)]
    public async Task<IActionResult> DownloadWorkingCopy(Guid id, CancellationToken ct)
    {
        try
        {
            var file = await importService.GenerateWorkingCopyAsync(id, UserId, ct);
            await activityService.LogAsync(new ActivityWriteRequest(
                ActivityCategory.Import, "DownloadWorkingCopy", $"Exported the private working copy for import {id}.",
                TargetType: "ImportJob", TargetId: id.ToString(), StatusCode: StatusCodes.Status200OK), ct);
            return File(file.Content, file.ContentType, file.FileName);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>Download an Excel error report for a job.</summary>
    [HttpGet("{id:guid}/error-report")]
    public async Task<IActionResult> DownloadErrorReport(Guid id, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(id, ct);
        if (job is null || !CanView(job)) return NotFound();
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
        var job = await importService.GetJobAsync(id, ct);
        if (job is null || !CanView(job)) return NotFound();
        try
        {
            var bytes = await importService.GenerateComparisonReportAsync(id, ct);
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"comparison_{id:N}.xlsx");
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    private bool CanView(CPQ_Import_App.Core.Models.ImportJob job)
        => job.WorkflowStage != ImportWorkflowStage.Private
            || string.Equals(job.CreatedBy, UserId, StringComparison.OrdinalIgnoreCase);

}
