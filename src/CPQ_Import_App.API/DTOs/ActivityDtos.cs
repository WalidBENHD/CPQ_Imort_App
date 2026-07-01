using CPQ_Import_App.Core.Enums;

namespace CPQ_Import_App.API.DTOs;

public record ActivityEventDto(
    Guid Id,
    DateTime OccurredAtUtc,
    ActivityCategory Category,
    string CategoryLabel,
    string Action,
    string? Description,
    string? UserId,
    string? UserDisplayName,
    string? UserRole,
    string? TargetType,
    string? TargetId,
    string? Route,
    string? HttpMethod,
    int? StatusCode,
    string? IpAddress,
    string? UserAgent,
    string? Country,
    string? City,
    string? MetadataJson);

public record ActivityOverviewDto(
    int TotalLast24h,
    int AuthEventsLast24h,
    int ImportEventsLast24h,
    int FailuresLast24h);

public record TrackPageViewRequest(string Page, string? Title, string? Referrer, string? ClientTime);
