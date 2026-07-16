using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.API.Mapping;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Metadata;
using CPQ_Import_App.Core.Security;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Capabilities.ImportsView)]
public class DashboardController(
    IImportService importService,
    AppDbContext db) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<ActionResult<DashboardOverviewDto>> GetOverview(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? "unknown";
        var now = DateTime.UtcNow;
        var today = now.Date;
        var tomorrow = today.AddDays(1);
        var agingCutoff = now.AddHours(-24);

        var jobs = await db.ImportJobs
            .AsNoTracking()
            .Where(j => j.WorkflowStage != ImportWorkflowStage.Private)
            .Select(j => new DashboardJobSnapshot(
                j.Id,
                j.EntityType,
                j.Status,
                j.OriginalFileName,
                j.CreatedAt,
                j.ProcessedAt,
                j.CommittedAt,
                j.RejectedAt,
                j.CommittedRows,
                j.TotalRows,
                j.WarningRows,
                j.ErrorRows,
                j.RejectionReason))
            .ToListAsync(ct);

        var activitySnapshots = await db.AuditLogs
            .AsNoTracking()
            .Where(a => a.ImportJob.WorkflowStage != ImportWorkflowStage.Private)
            .OrderByDescending(a => a.PerformedAt)
            .Take(10)
            .Select(a => new DashboardActivitySnapshot(
                a.ImportJobId,
                a.Action,
                a.ImportJob.EntityType,
                a.ImportJob.OriginalFileName,
                a.PerformedByDisplayName,
                a.PerformedAt,
                a.Details))
            .ToListAsync(ct);

        var activityFeed = activitySnapshots
            .Select(a =>
            {
                var dataset = DatasetCatalog.Get(a.EntityType);
                return new DashboardActivityDto(
                    a.JobId,
                    a.Action,
                $"{dataset.DisplayName} - {a.OriginalFileName}",
                    dataset.DisplayName,
                    a.PerformedByDisplayName,
                    a.PerformedAt,
                    a.Details);
            })
            .ToList();

        var recentSubmissions = await importService.GetJobsPagedAsync(1, 5, userId, ct: ct);

        var openQueue = jobs.Count(j => j.Status == ImportStatus.AwaitingApproval || j.Status == ImportStatus.Approved || j.Status == ImportStatus.NeedsCorrection);

        var summary = new DashboardSummaryDto(
            openQueue,
            jobs.Count(j => j.Status == ImportStatus.Committed && j.CommittedAt.HasValue && j.CommittedAt.Value >= today && j.CommittedAt.Value < tomorrow),
            jobs.Count(j => j.Status == ImportStatus.Rejected),
            jobs.Count,
            jobs.Count(j => j.Status == ImportStatus.NeedsCorrection || (j.Status == ImportStatus.AwaitingApproval && j.ErrorRows > 0)),
            jobs.Count(j => (j.Status == ImportStatus.AwaitingApproval || j.Status == ImportStatus.Approved || j.Status == ImportStatus.NeedsCorrection) && (j.ProcessedAt ?? j.CreatedAt) < agingCutoff));

        var attentionItems = BuildAttentionItems(jobs);
        var datasetHealth = BuildDatasetHealth(jobs);

        return Ok(new DashboardOverviewDto(
            summary,
            attentionItems,
            datasetHealth,
            activityFeed,
            recentSubmissions.Items.Select(j => j.ToDto()).ToList()));
    }

    private static IReadOnlyList<DashboardAttentionDto> BuildAttentionItems(
        IReadOnlyList<DashboardJobSnapshot> jobs)
    {
        var items = new List<DashboardAttentionDto>();

        var oldestPending = jobs
            .Where(j => j.Status == ImportStatus.AwaitingApproval || j.Status == ImportStatus.Approved || j.Status == ImportStatus.NeedsCorrection)
            .OrderBy(j => j.ProcessedAt ?? j.CreatedAt)
            .FirstOrDefault();

        if (oldestPending is not null)
        {
            var age = DateTime.UtcNow - (oldestPending.ProcessedAt ?? oldestPending.CreatedAt);
            items.Add(new DashboardAttentionDto(
                oldestPending.Id,
                oldestPending.Status == ImportStatus.Approved ? "Publication pending" : "Oldest approval pending",
                DatasetCatalog.Get(oldestPending.EntityType).DisplayName,
                $"Waiting {FormatAge(age)} for action. {(oldestPending.Status == ImportStatus.Approved ? "Approved and ready to publish to CPQ." : oldestPending.Status == ImportStatus.NeedsCorrection || oldestPending.ErrorRows > 0 ? $"{oldestPending.ErrorRows} error rows need attention." : "Ready for approver action.")}",
                age >= TimeSpan.FromHours(24) ? "High" : "Medium",
                "Review",
                oldestPending.ProcessedAt ?? oldestPending.CreatedAt));
        }

        var largestExceptionBatch = jobs
            .Where(j => (j.Status == ImportStatus.AwaitingApproval || j.Status == ImportStatus.NeedsCorrection) && j.ErrorRows > 0)
            .OrderByDescending(j => j.ErrorRows)
            .ThenByDescending(j => j.CreatedAt)
            .FirstOrDefault();

        if (largestExceptionBatch is not null)
        {
            items.Add(new DashboardAttentionDto(
                largestExceptionBatch.Id,
                largestExceptionBatch.Status == ImportStatus.NeedsCorrection ? "Correction required" : "Largest exception batch",
                DatasetCatalog.Get(largestExceptionBatch.EntityType).DisplayName,
                $"{largestExceptionBatch.ErrorRows} error rows and {largestExceptionBatch.WarningRows} warnings are blocking the release.",
                "High",
                "Inspect errors",
                largestExceptionBatch.ProcessedAt ?? largestExceptionBatch.CreatedAt));
        }

        var latestRejected = jobs
            .Where(j => j.Status == ImportStatus.Rejected)
            .OrderByDescending(j => j.RejectedAt ?? j.CreatedAt)
            .FirstOrDefault();

        if (latestRejected is not null)
        {
            items.Add(new DashboardAttentionDto(
                latestRejected.Id,
                "Most recent rejection",
                DatasetCatalog.Get(latestRejected.EntityType).DisplayName,
                string.IsNullOrWhiteSpace(latestRejected.RejectionReason)
                    ? "Rejected without a recorded reason."
                    : latestRejected.RejectionReason,
                "Medium",
                "Review reason",
                latestRejected.RejectedAt ?? latestRejected.CreatedAt));
        }

        var latestFailed = jobs
            .Where(j => j.Status == ImportStatus.Failed)
            .OrderByDescending(j => j.ProcessedAt ?? j.CreatedAt)
            .FirstOrDefault();

        if (latestFailed is not null)
        {
            items.Add(new DashboardAttentionDto(
                latestFailed.Id,
                "Latest failed import",
                DatasetCatalog.Get(latestFailed.EntityType).DisplayName,
                $"The last processing attempt failed before approval.",
                "High",
                "Investigate",
                latestFailed.ProcessedAt ?? latestFailed.CreatedAt));
        }

        if (items.Count == 0)
        {
            items.Add(new DashboardAttentionDto(
                null,
                "No open exceptions",
                "Portfolio",
                "The current queue is clean. Keep monitoring new submissions and approvals.",
                "Low",
                null,
                null));
        }

        return items;
    }

    private static IReadOnlyList<DashboardDatasetHealthDto> BuildDatasetHealth(
        IReadOnlyList<DashboardJobSnapshot> jobs)
    {
        return DatasetCatalog.All
            .Select(dataset =>
            {
                var subset = jobs.Where(j => j.EntityType == dataset.EntityType).ToList();
                var totalRows = subset.Sum(j => j.TotalRows);
                var errorRows = subset.Sum(j => j.ErrorRows);
                var openItems = subset.Count(j => j.Status == ImportStatus.AwaitingApproval || j.Status == ImportStatus.Approved || j.Status == ImportStatus.NeedsCorrection);
                var lastActivity = subset
                    .Select(j => j.CommittedAt ?? j.RejectedAt ?? j.ProcessedAt ?? j.CreatedAt)
                    .OrderByDescending(x => x)
                    .FirstOrDefault();
                var errorRate = totalRows == 0 ? 0d : Math.Round((double)errorRows / totalRows * 100, 1);
                var status = openItems == 0 && errorRate < 5
                    ? "Healthy"
                    : openItems <= 2 && errorRate < 15
                        ? "Watch"
                        : "Attention";

                return new DashboardDatasetHealthDto(
                    dataset.EntityType,
                    dataset.DisplayName,
                    dataset.Owner,
                    status,
                    dataset.CurrentVersion,
                    subset.Count,
                    openItems,
                    errorRows,
                    errorRate,
                    lastActivity == default ? null : lastActivity);
            })
            .OrderByDescending(x => x.OpenItems)
            .ThenByDescending(x => x.ErrorRate)
            .ThenBy(x => x.DatasetName)
            .ToList();
    }

    private static string FormatAge(TimeSpan age)
    {
        if (age.TotalDays >= 1)
        {
            return $"{Math.Floor(age.TotalDays)}d";
        }

        if (age.TotalHours >= 1)
        {
            return $"{Math.Floor(age.TotalHours)}h";
        }

        return $"{Math.Max(1, Math.Floor(age.TotalMinutes))}m";
    }

    private sealed record DashboardJobSnapshot(
        Guid Id,
        EntityType EntityType,
        ImportStatus Status,
        string OriginalFileName,
        DateTime CreatedAt,
        DateTime? ProcessedAt,
        DateTime? CommittedAt,
        DateTime? RejectedAt,
        int CommittedRows,
        int TotalRows,
        int WarningRows,
        int ErrorRows,
        string? RejectionReason);

    private sealed record DashboardActivitySnapshot(
        Guid JobId,
        string Action,
        EntityType EntityType,
        string OriginalFileName,
        string PerformedByDisplayName,
        DateTime PerformedAt,
        string? Details);
}
