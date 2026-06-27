using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Mapping;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
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

        if (!Enum.TryParse<EntityType>(entityType, ignoreCase: true, out var et) || et == EntityType.Unknown)
            return BadRequest($"Invalid entity type '{entityType}'. Valid values: Article, PriceList, Description, CurrencyRate.");

        var allowedExtensions = new[] { ".xlsx", ".csv" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest($"File type '{ext}' is not supported. Use .xlsx or .csv.");

        await using var stream = file.OpenReadStream();
        try
        {
            var job = await importService.UploadAsync(stream, file.FileName, et, UserId, UserDisplayName, ct);
            
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

    /// <summary>Get paginated list of import jobs.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ImportJobDto>>> GetJobs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;
        var (items, total) = await importService.GetJobsPagedAsync(page, pageSize, ct);
        return Ok(new PagedResult<ImportJobDto>(items.Select(j => j.ToDto()).ToList(), total, page, pageSize));
    }

    /// <summary>Get the staging rows (preview) for a job.</summary>
    [HttpGet("{id:guid}/rows")]
    public async Task<ActionResult<PagedResult<StagingRowDto>>> GetRows(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;

        RowStatus? filterStatus = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<RowStatus>(status, ignoreCase: true, out var rs))
            filterStatus = rs;

        var (items, total) = await importService.GetStagingRowsAsync(id, page, pageSize, filterStatus, ct);
        return Ok(new PagedResult<StagingRowDto>(items.Select(r => r.ToDto()).ToList(), total, page, pageSize));
    }

    /// <summary>Commit a job — role: cpq-approver required.</summary>
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
            
            return Ok(new CommitResultDto(job.Id, job.CommittedRows, $"Successfully committed {job.CommittedRows} rows."));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
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
            
            return Ok(job.ToDto());
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
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
