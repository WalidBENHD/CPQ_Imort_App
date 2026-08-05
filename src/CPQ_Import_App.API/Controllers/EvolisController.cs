using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CPQ_Import_App.API.Services;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Core.Security;
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
        => Ok(await GetHistoryAsync(UserId, page, pageSize, search, status, ct));

    [HttpGet("history/all")]
    [Authorize(Policy = Capabilities.ToolsEvolisAudit)]
    public async Task<ActionResult<EvolisDecryptionHistoryDto>> GetAllHistory(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null, [FromQuery] string? status = null,
        CancellationToken ct = default)
        => Ok(await GetHistoryAsync(null, page, pageSize, search, status, ct));

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
        string? userId, int page, int pageSize, string? search, string? status, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        EvolisDecryptionStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<EvolisDecryptionStatus>(status, true, out var value))
            parsedStatus = value;

        var result = await historyService.GetPagedAsync(userId, page, pageSize, search, parsedStatus, ct);
        var items = result.Items.Select(run => new EvolisDecryptionRunDto(
            run.Id, run.FileName, run.FileSize, run.UserId, run.UserDisplayName,
            run.StartedAtUtc, run.CompletedAtUtc, run.Status, run.Status.ToString(),
            run.OutputFormat, run.FailureReason, run.HasSourceFile, run.HasResult)).ToList();
        return new EvolisDecryptionHistoryDto(items, result.Total, page, pageSize);
    }

    private static EvolisDecryptionMetricsDto ToMetricsDto(EvolisDecryptionMetrics metrics)
        => new(metrics.Total, metrics.ThisMonth, metrics.Successful, metrics.Failed, metrics.FailedThisMonth);

    private async Task<EvolisDecryptionRun?> GetAuthorizedRunAsync(Guid id, CancellationToken ct)
    {
        var run = await historyService.GetByIdAsync(id, ct);
        if (run is null) return null;
        if (run.UserId == UserId) return run;

        var auditAccess = await authorizationService.AuthorizeAsync(User, Capabilities.ToolsEvolisAudit);
        return auditAccess.Succeeded ? run : null;
    }

    private static EvolisDecryptResponseDto ToResultDto(EvolisDecryptionRun run)
        => new(run.Id, run.FileName,
            $"{Path.GetFileNameWithoutExtension(run.FileName)}_decrypted.pdf", run.DecryptedContent!);
}
