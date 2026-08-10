using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.API.Services;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Core.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/business-trace")]
[Authorize(Policy = Capabilities.ImportsView)]
public sealed class BusinessTraceController(
    IBusinessTraceService traceService,
    BusinessTracePdfDocumentBuilder reportBuilder) : ControllerBase
{
    [HttpGet("suggestions")]
    public async Task<ActionResult<IReadOnlyList<BusinessTraceSuggestion>>> GetSuggestions(
        [FromQuery] string scopeKey,
        [FromQuery] EntityType objectType,
        [FromQuery] int limit = 6,
        CancellationToken ct = default)
    {
        try
        {
            return Ok(await traceService.GetSuggestionsAsync(scopeKey, objectType, limit, ct));
        }
        catch (InvalidDataException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("search")]
    public async Task<ActionResult<BusinessTraceResult>> Search(
        [FromQuery] string scopeKey,
        [FromQuery] EntityType objectType,
        [FromQuery] string identifier,
        CancellationToken ct = default)
    {
        try
        {
            var result = await traceService.SearchAsync(scopeKey, objectType, identifier, ct);
            return result is null
                ? NotFound(new { error = $"'{identifier}' was not found in the selected scope's publication history." })
                : Ok(result);
        }
        catch (InvalidDataException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("report")]
    public async Task<IActionResult> GenerateReport(
        [FromQuery] string scopeKey,
        [FromQuery] EntityType objectType,
        [FromQuery] string identifier,
        CancellationToken ct = default)
    {
        try
        {
            var result = await traceService.SearchAsync(scopeKey, objectType, identifier, ct);
            if (result is null)
            {
                return NotFound(new { error = $"'{identifier}' was not found in the selected scope's publication history." });
            }

            var generatedBy = User.FindFirstValue("name")
                ?? User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? "Authenticated user";
            var safeIdentifier = string.Concat(result.Identifier.Select(character =>
                Path.GetInvalidFileNameChars().Contains(character) ? '_' : character));
            var fileName = $"PDU_Trace_Evidence_{safeIdentifier}_{DateTime.UtcNow:yyyyMMdd}.pdf";

            return File(reportBuilder.Build(result, generatedBy), "application/pdf", fileName);
        }
        catch (InvalidDataException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
