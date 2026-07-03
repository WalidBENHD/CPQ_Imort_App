using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Infrastructure.Services;
using CPQ_Import_App.API.Monitoring;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace CPQ_Import_App.API.Middleware;

public class ActivityTrackingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext context,
        IActivityService activityService,
        ILiveUserPresenceTracker liveUserPresenceTracker,
        IOptions<AppActivityTrackingOptions> options)
    {
        await next(context);

        var path = context.Request.Path.Value ?? string.Empty;
        if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.User.FindFirstValue("sub");

            if (!string.IsNullOrWhiteSpace(userId))
            {
                liveUserPresenceTracker.MarkSeen(userId);
            }
        }

        if (!options.Value.Enabled)
        {
            return;
        }

        if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (path.StartsWith("/api/activity", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var method = context.Request.Method.ToUpperInvariant();
        var statusCode = context.Response.StatusCode;

        var shouldLog = method is not "GET" && method is not "HEAD" && method is not "OPTIONS";
        var isAuthLogin = path.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase);
        var isFailure = statusCode >= 400;

        if (!shouldLog && !isAuthLogin && !isFailure)
        {
            return;
        }

        var category = ResolveCategory(path);
        await activityService.LogAsync(new ActivityWriteRequest(
            Category: category,
            Action: $"{method} {path}",
            Description: statusCode >= 400 ? $"Request failed with status {statusCode}." : "Request executed.",
            StatusCode: statusCode,
            ExplicitRoute: path,
            ExplicitMethod: method),
            context.RequestAborted);
    }

    private static ActivityCategory ResolveCategory(string path)
    {
        if (path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase))
            return ActivityCategory.Authentication;
        if (path.StartsWith("/api/imports", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/templates", StringComparison.OrdinalIgnoreCase))
            return ActivityCategory.Import;
        if (path.StartsWith("/api/admin", StringComparison.OrdinalIgnoreCase))
            return ActivityCategory.Admin;
        return ActivityCategory.System;
    }
}
