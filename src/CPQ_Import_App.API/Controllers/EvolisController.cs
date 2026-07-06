using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/evolis")]
[Authorize(Policy = "InternalToolsOnly")]
public class EvolisController(IEvolisDecryptorService decryptorService) : ControllerBase
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
            var downloadFileName = $"{Path.GetFileNameWithoutExtension(file.FileName)}_decrypted.txt";

            return Ok(new EvolisDecryptResponseDto(file.FileName, downloadFileName, content));
        }
        catch (InvalidDataException ex)
        {
            return UnprocessableEntity(new { error = ex.Message });
        }
    }
}