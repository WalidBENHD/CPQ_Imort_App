using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CPQ_Import_App.API.Services;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/evolis")]
[Authorize(Policy = "InternalToolsOnly")]
public class EvolisController(
    IEvolisDecryptorService decryptorService,
    EvolisWordDocumentBuilder wordDocumentBuilder,
    EvolisPdfDocumentBuilder pdfDocumentBuilder) : ControllerBase
{
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

        await using var stream = file.OpenReadStream();
        try
        {
            var content = await decryptorService.DecryptAsync(stream, ct);
            var downloadFileName = $"{Path.GetFileNameWithoutExtension(file.FileName)}_decrypted.pdf";

            return Ok(new EvolisDecryptResponseDto(file.FileName, downloadFileName, content));
        }
        catch (InvalidDataException ex)
        {
            return UnprocessableEntity(new { error = ex.Message });
        }
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
}