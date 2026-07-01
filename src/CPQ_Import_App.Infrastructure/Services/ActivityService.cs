using System.Security.Claims;
using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace CPQ_Import_App.Infrastructure.Services;

public record GeoLocationResult(string? Country, string? City);

public interface IGeoLookupService
{
    Task<GeoLocationResult?> ResolveAsync(string? ipAddress, CancellationToken ct = default);
}

public class NoopGeoLookupService : IGeoLookupService
{
    public Task<GeoLocationResult?> ResolveAsync(string? ipAddress, CancellationToken ct = default)
        => Task.FromResult<GeoLocationResult?>(null);
}

public record ActivityWriteRequest(
    ActivityCategory Category,
    string Action,
    string? Description = null,
    string? TargetType = null,
    string? TargetId = null,
    int? StatusCode = null,
    object? Metadata = null,
    string? ExplicitUserId = null,
    string? ExplicitUserName = null,
    string? ExplicitUserRole = null,
    string? ExplicitRoute = null,
    string? ExplicitMethod = null);

public interface IActivityService
{
    Task LogAsync(ActivityWriteRequest request, CancellationToken ct = default);
    Task<(IReadOnlyList<ActivityEvent> Items, int Total)> GetPagedAsync(
        int page,
        int pageSize,
        DateTime? fromUtc,
        DateTime? toUtc,
        string? userId,
        string? excludeUserId,
        ActivityCategory? category,
        string? action,
        string? search,
        int? statusCode,
        CancellationToken ct = default);
    Task<ActivityOverview> GetOverviewAsync(CancellationToken ct = default);
    Task<int> CleanupOlderThanAsync(int retentionDays, CancellationToken ct = default);
}

public record ActivityOverview(int TotalLast24h, int AuthEventsLast24h, int ImportEventsLast24h, int FailuresLast24h);

public class ActivityService(
    IActivityRepository activityRepository,
    IHttpContextAccessor httpContextAccessor,
    IGeoLookupService geoLookupService,
    ILogger<ActivityService> logger) : IActivityService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = false };

    public async Task LogAsync(ActivityWriteRequest request, CancellationToken ct = default)
    {
        try
        {
            var httpContext = httpContextAccessor.HttpContext;
            var principal = httpContext?.User;

            var userId = request.ExplicitUserId
                ?? principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? principal?.FindFirst("sub")?.Value;

            var userName = request.ExplicitUserName
                ?? principal?.FindFirst("name")?.Value
                ?? principal?.FindFirst(ClaimTypes.Name)?.Value
                ?? principal?.FindFirst("preferred_username")?.Value;

            var userRole = request.ExplicitUserRole
                ?? principal?.FindFirst("roles")?.Value
                ?? principal?.FindFirst(ClaimTypes.Role)?.Value;

            var route = request.ExplicitRoute ?? httpContext?.Request.Path.Value;
            var method = request.ExplicitMethod ?? httpContext?.Request.Method;

            var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString();
            var userAgent = httpContext?.Request.Headers["User-Agent"].ToString();
            var geo = await geoLookupService.ResolveAsync(ipAddress, ct);

            var activityEvent = new ActivityEvent
            {
                OccurredAtUtc = DateTime.UtcNow,
                Category = request.Category,
                Action = request.Action,
                Description = request.Description,
                UserId = userId,
                UserDisplayName = userName,
                UserRole = userRole,
                TargetType = request.TargetType,
                TargetId = request.TargetId,
                Route = route,
                HttpMethod = method,
                StatusCode = request.StatusCode,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Country = geo?.Country,
                City = geo?.City,
                MetadataJson = request.Metadata != null ? JsonSerializer.Serialize(request.Metadata, JsonOpts) : null
            };

            await activityRepository.AddAsync(activityEvent, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to persist activity event for action {Action}", request.Action);
        }
    }

    public Task<(IReadOnlyList<ActivityEvent> Items, int Total)> GetPagedAsync(
        int page,
        int pageSize,
        DateTime? fromUtc,
        DateTime? toUtc,
        string? userId,
        string? excludeUserId,
        ActivityCategory? category,
        string? action,
        string? search,
        int? statusCode,
        CancellationToken ct = default)
        => activityRepository.GetPagedAsync(page, pageSize, fromUtc, toUtc, userId, excludeUserId, category, action, search, statusCode, ct);

    public async Task<ActivityOverview> GetOverviewAsync(CancellationToken ct = default)
    {
        var since = DateTime.UtcNow.AddHours(-24);

        var total = await activityRepository.CountSinceAsync(since, null, ct);
        var auth = await activityRepository.CountSinceAsync(since, ActivityCategory.Authentication, ct);
        var imports = await activityRepository.CountSinceAsync(since, ActivityCategory.Import, ct);
        var failures = await activityRepository.CountFailuresSinceAsync(since, ct);

        return new ActivityOverview(total, auth, imports, failures);
    }

    public Task<int> CleanupOlderThanAsync(int retentionDays, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddDays(-Math.Abs(retentionDays));
        return activityRepository.DeleteOlderThanAsync(cutoff, ct);
    }
}
