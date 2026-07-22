using System.Security.Claims;
using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Mapping;
using CPQ_Import_App.API.Security;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/maintenance-requests")]
[Authorize(Policy = Capabilities.ImportsView)]
public sealed class MaintenanceRequestsController(IImportService importService) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? "unknown";

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ImportJobDto>>> GetRequests(CancellationToken ct)
    {
        var (jobs, _) = await importService.GetJobsPagedAsync(
            1,
            int.MaxValue,
            UserId,
            ct: ct);

        var requests = jobs
            .Where(job => string.Equals(Path.GetExtension(job.FileName), ".hmi", StringComparison.OrdinalIgnoreCase)
                || string.Equals(Path.GetExtension(job.OriginalFileName), ".hmi", StringComparison.OrdinalIgnoreCase))
            .Select(job => job.ToDto())
            .ToList();

        return Ok(requests);
    }
}
