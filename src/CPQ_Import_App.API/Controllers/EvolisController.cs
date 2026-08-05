using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CPQ_Import_App.API.Services;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Core.Security;
using CPQ_Import_App.Infrastructure.Services;
using System.Security.Claims;
using System.Security.Cryptography;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/evolis")]
[Authorize(Policy = "InternalToolsOnly")]
public class EvolisController(
    IEvolisDecryptorService decryptorService,
    IEvolisHistoryService historyService,
    IAuthorizationService authorizationService,
    IActivityService activityService,
    EvolisWordDocumentBuilder wordDocumentBuilder,
    EvolisPdfDocumentBuilder pdfDocumentBuilder) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? "unknown";
    private string UserDisplayName => User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? UserId;

    [HttpOptions("decrypt")]
    [AllowAnonymous]
    public IActionResult DecryptOptions()
    {
        return NoContent();
    }

    [HttpPost("decrypt")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<EvolisDecryptResponseDto>> Decrypt([FromForm] IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "No file provided." });
        }

        await using var source = file.OpenReadStream();
        using var stream = new MemoryStream();
        await source.CopyToAsync(stream, ct);
        var sourceBytes = stream.ToArray();
        var hash = Convert.ToHexString(SHA256.HashData(sourceBytes));
        var safeFileName = Path.GetFileName(file.FileName);
        var run = await historyService.StartAsync(safeFileName, file.Length, hash, file.ContentType,
            sourceBytes, UserId, UserDisplayName, ct);
        try
        {
            stream.Position = 0;
            var content = await decryptorService.DecryptAsync(stream, ct);
            var downloadFileName = $"{Path.GetFileNameWithoutExtension(safeFileName)}_decrypted.pdf";
            await historyService.CompleteAsync(run.Id, "PDF", content, ct);

            return Ok(new EvolisDecryptResponseDto(run.Id, safeFileName, downloadFileName, content));
        }
        catch (InvalidDataException ex)
        {
            await historyService.FailAsync(run.Id, ex.Message, ct);
            return UnprocessableEntity(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            await historyService.FailAsync(run.Id, ex.GetBaseException().Message, ct);
            throw;
        }
    }

    [HttpGet("history/{id:guid}")]
    public async Task<ActionResult<EvolisDecryptResponseDto>> GetHistoryResult(Guid id, CancellationToken ct)
    {
        var run = await GetAuthorizedRunAsync(id, ct);
        if (run is null) return NotFound(new { error = "Decryption record not found." });
        if (!run.HasResult || string.IsNullOrEmpty(run.DecryptedContent))
            return Conflict(new { error = "This record has no retained result to reopen." });

        return Ok(ToResultDto(run));
    }

    [HttpGet("history/{id:guid}/source")]
    public async Task<IActionResult> DownloadSource(Guid id, CancellationToken ct)
    {
        var run = await GetAuthorizedRunAsync(id, ct);
        if (run is null) return NotFound(new { error = "Decryption record not found." });
        if (!run.HasSourceFile || run.SourceFileContent is null)
            return NotFound(new { error = "The source file was not retained for this older record." });

        return File(run.SourceFileContent, run.SourceContentType ?? "application/octet-stream", run.FileName);
    }

    [HttpGet("history/{id:guid}/report/{format}")]
    public async Task<IActionResult> DownloadStoredReport(Guid id, string format, CancellationToken ct)
    {
        var run = await GetAuthorizedRunAsync(id, ct);
        if (run is null) return NotFound(new { error = "Decryption record not found." });
        if (!run.HasResult || string.IsNullOrEmpty(run.DecryptedContent))
            return Conflict(new { error = "This record has no retained result to export." });

        var baseName = Path.GetFileNameWithoutExtension(run.FileName);
        if (format.Equals("pdf", StringComparison.OrdinalIgnoreCase))
            return File(pdfDocumentBuilder.Build(run.DecryptedContent, run.FileName), "application/pdf", $"{baseName}_decrypted.pdf");
        if (format.Equals("word", StringComparison.OrdinalIgnoreCase) || format.Equals("docx", StringComparison.OrdinalIgnoreCase))
            return File(wordDocumentBuilder.Build(run.DecryptedContent, run.FileName),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"{baseName}_decrypted.docx");

        return BadRequest(new { error = "Supported report formats are PDF and Word." });
    }

    [HttpGet("history")]
    public async Task<ActionResult<EvolisDecryptionHistoryDto>> GetMyHistory(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? status = null,
        CancellationToken ct = default)
        => Ok(await GetHistoryAsync(UserId, page, pageSize, search, status, includeDeleted: false, ct));

    [HttpGet("history/all")]
    [Authorize(Policy = Capabilities.ToolsEvolisAudit)]
    public async Task<ActionResult<EvolisDecryptionHistoryDto>> GetAllHistory(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? status = null,
        CancellationToken ct = default)
        => Ok(await GetHistoryAsync(null, page, pageSize, search, status, includeDeleted: true, ct));

    [HttpGet("history/metrics")]
    public async Task<ActionResult<EvolisDecryptionMetricsDto>> GetMyMetrics(CancellationToken ct)
    {
        var metrics = await historyService.GetMetricsAsync(UserId, ct);
        return Ok(ToMetricsDto(metrics));
    }

    [HttpGet("metrics")]
    [Authorize(Policy = Capabilities.ToolsEvolisAudit)]
    public async Task<ActionResult<EvolisDecryptionMetricsDto>> GetMetrics(CancellationToken ct)
    {
        var metrics = await historyService.GetMetricsAsync(null, ct);
        return Ok(ToMetricsDto(metrics));
    }

    [HttpDelete("history")]
    [Authorize(Policy = Capabilities.SystemMaintenance)]
    public async Task<ActionResult<EvolisHistoryResetDto>> ResetHistory(CancellationToken ct)
    {
        var deletedRecords = await historyService.ResetAsync(ct);
        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "ResetEvolisHistory",
            $"Deleted {deletedRecords} Evolis decryption record(s), including retained source files and results.",
            TargetType: "EvolisDecryptionHistory",
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { DeletedRecords = deletedRecords }), ct);

        return Ok(new EvolisHistoryResetDto(
            deletedRecords,
            "Evolis history and retained files were deleted. Other application data was not changed."));
    }

    [HttpDelete("history/{id:guid}")]
    public async Task<IActionResult> RemoveFromMyHistory(Guid id, CancellationToken ct)
    {
        var removed = await historyService.SoftDeleteAsync(id, UserId, UserDisplayName, ct);
        if (!removed) return NotFound(new { error = "The Evolis record was not found in your history." });

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.System,
            "RemoveEvolisHistoryRecord",
            "Removed an Evolis record from personal history. The governed admin record was retained.",
            TargetType: "EvolisDecryptionRun",
            TargetId: id.ToString(),
            StatusCode: StatusCodes.Status200OK), ct);
        return Ok(new { message = "The record was removed from your history and retained for administrators." });
    }

    [HttpDelete("history/{id:guid}/permanent")]
    [Authorize(Policy = Capabilities.SystemMaintenance)]
    public async Task<IActionResult> PermanentlyDeleteHistory(Guid id, CancellationToken ct)
    {
        var run = await historyService.GetByIdAsync(id, ct);
        if (run is null) return NotFound(new { error = "The Evolis record was not found." });
        if (!run.IsDeleted)
            return Conflict(new { error = "This record still exists in the user's history and cannot be permanently deleted." });

        if (!await historyService.PermanentlyDeleteAsync(id, ct))
            return Conflict(new { error = "The record changed before it could be permanently deleted. Refresh and try again." });

        await activityService.LogAsync(new ActivityWriteRequest(
            ActivityCategory.Admin,
            "PermanentlyDeleteEvolisHistoryRecord",
            $"Permanently deleted the user-removed Evolis record '{run.FileName}'.",
            TargetType: "EvolisDecryptionRun",
            TargetId: id.ToString(),
            StatusCode: StatusCodes.Status200OK,
            Metadata: new { run.FileName, OwnerUserId = run.UserId, run.DeletedAtUtc }), ct);
        return Ok(new { message = "The deleted Evolis record was permanently erased." });
    }

    [HttpPost("decrypt-word")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> DecryptWord([FromForm] IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "No file provided." });
        }

        await using var stream = file.OpenReadStream();
        try
        {
            var content = await decryptorService.DecryptAsync(stream, ct);
            var document = wordDocumentBuilder.Build(content, file.FileName);
            var downloadFileName = $"{Path.GetFileNameWithoutExtension(file.FileName)}_decrypted.docx";

            return File(
                document,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                downloadFileName);
        }
        catch (InvalidDataException ex)
        {
            return UnprocessableEntity(new { error = ex.Message });
        }
    }

    [HttpPost("decrypt-pdf")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> DecryptPdf([FromForm] IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "No file provided." });
        }

        await using var stream = file.OpenReadStream();
        try
        {
            var content = await decryptorService.DecryptAsync(stream, ct);
            var document = pdfDocumentBuilder.Build(content, file.FileName);
            var downloadFileName = $"{Path.GetFileNameWithoutExtension(file.FileName)}_decrypted.pdf";

            return File(document, "application/pdf", downloadFileName);
        }
        catch (InvalidDataException ex)
        {
            return UnprocessableEntity(new { error = ex.Message });
        }
    }

    private async Task<EvolisDecryptionHistoryDto> GetHistoryAsync(
        string? userId, int page, int pageSize, string? search, string? status, bool includeDeleted, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        EvolisDecryptionStatus? parsedStatus = null;
        var deletedOnly = string.Equals(status, "Deleted", StringComparison.OrdinalIgnoreCase);
        if (!deletedOnly && !string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<EvolisDecryptionStatus>(status, true, out var value))
            parsedStatus = value;

        var result = await historyService.GetPagedAsync(userId, page, pageSize, search, parsedStatus,
            includeDeleted, deletedOnly, ct);
        var items = result.Items.Select(run => new EvolisDecryptionRunDto(
            run.Id, run.FileName, run.FileSize, run.UserId, run.UserDisplayName,
            run.StartedAtUtc, run.CompletedAtUtc, run.Status, run.IsDeleted ? "Deleted" : run.Status.ToString(),
            run.OutputFormat, run.FailureReason, run.HasSourceFile, run.HasResult,
            run.IsDeleted, run.DeletedAtUtc, run.DeletedByDisplayName)).ToList();
        return new EvolisDecryptionHistoryDto(items, result.Total, page, pageSize);
    }

    private static EvolisDecryptionMetricsDto ToMetricsDto(EvolisDecryptionMetrics metrics)
        => new(metrics.Total, metrics.ThisMonth, metrics.Successful, metrics.Failed, metrics.FailedThisMonth, metrics.Deleted);

    private async Task<EvolisDecryptionRun?> GetAuthorizedRunAsync(Guid id, CancellationToken ct)
    {
        var run = await historyService.GetByIdAsync(id, ct);
        if (run is null) return null;
        if (run.IsDeleted)
        {
            var deletedAuditAccess = await authorizationService.AuthorizeAsync(User, Capabilities.ToolsEvolisAudit);
            return deletedAuditAccess.Succeeded ? run : null;
        }
        if (run.UserId == UserId) return run;

        var auditAccess = await authorizationService.AuthorizeAsync(User, Capabilities.ToolsEvolisAudit);
        return auditAccess.Succeeded ? run : null;
    }

    private static EvolisDecryptResponseDto ToResultDto(EvolisDecryptionRun run)
        => new(run.Id, run.FileName,
            $"{Path.GetFileNameWithoutExtension(run.FileName)}_decrypted.pdf", run.DecryptedContent!);
}
