using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Mapping;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Security;
using CPQ_Import_App.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ActivityController(IActivityService activityService) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? string.Empty;

    private string UserDisplayName => User.FindFirstValue("name")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? UserId;

    [HttpPost("track-view")]
    public async Task<IActionResult> TrackPageView([FromBody] TrackPageViewRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Page))
        {
            return BadRequest(new { error = "Page is required." });
        }

        await activityService.LogAsync(new ActivityWriteRequest(
            Category: ActivityCategory.Navigation,
            Action: "PageView",
            Description: $"Visited {request.Page}",
            TargetType: "Page",
            TargetId: request.Page,
            StatusCode: StatusCodes.Status200OK,
            Metadata: new
            {
                request.Page,
                request.Title,
                request.Referrer,
                request.ClientTime
            },
            ExplicitUserId: UserId,
            ExplicitUserName: UserDisplayName,
            ExplicitRoute: request.Page,
            ExplicitMethod: "NAVIGATE"),
            ct);

        return NoContent();
    }

    [HttpGet("overview")]
    [Authorize(Policy = Capabilities.AuditView)]
    public async Task<ActionResult<ActivityOverviewDto>> GetOverview(CancellationToken ct)
    {
        var overview = await activityService.GetOverviewAsync(ct);
        return Ok(overview.ToDto());
    }

    [HttpGet]
    [Authorize(Policy = Capabilities.AuditView)]
    public async Task<ActionResult<PagedResult<ActivityEventDto>>> GetActivities(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        [FromQuery] string? userId = null,
        [FromQuery] bool excludeCurrentUser = false,
        [FromQuery] string? category = null,
        [FromQuery] string? action = null,
        [FromQuery] string? search = null,
        [FromQuery] int? statusCode = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;

        if (fromUtc.HasValue && toUtc.HasValue && fromUtc > toUtc)
        {
            return BadRequest(new { error = "fromUtc must be before toUtc." });
        }

        ActivityCategory? parsedCategory = null;
        if (!string.IsNullOrWhiteSpace(category) && Enum.TryParse<ActivityCategory>(category, true, out var categoryValue))
        {
            parsedCategory = categoryValue;
        }

        var excludeUserId = excludeCurrentUser ? UserId : null;

        var (items, total) = await activityService.GetPagedAsync(
            page,
            pageSize,
            fromUtc,
            toUtc,
            userId,
            excludeUserId,
            parsedCategory,
            action,
            search,
            statusCode,
            ct);

        return Ok(new PagedResult<ActivityEventDto>(items.Select(x => x.ToDto()).ToList(), total, page, pageSize));
    }
}
