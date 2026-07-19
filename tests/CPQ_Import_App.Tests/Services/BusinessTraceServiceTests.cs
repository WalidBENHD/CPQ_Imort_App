using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Tests.Services;

public class BusinessTraceServiceTests
{
    [Fact]
    public async Task SearchAsync_UsesLatestPublishedValuesAndPreservesEarlierChanges()
    {
        await using var db = CreateDb();
        var first = PublishedJob(EntityType.Article, "articles-2025.xlsx", new DateTime(2025, 1, 10, 9, 0, 0, DateTimeKind.Utc));
        var second = PublishedJob(EntityType.Article, "articles-2026.xlsx", new DateTime(2026, 1, 12, 10, 0, 0, DateTimeKind.Utc));
        second.CreatedByDisplayName = "Nina Preparer";
        second.ApprovedByDisplayName = "Adam Approver";
        second.ApprovedAt = second.CommittedAt!.Value.AddMinutes(-10);
        second.CommittedBy = "Paula Publisher";
        second.ApprovedComparisonJson = ApprovalSnapshot(second, added: 0, modified: 1, removed: 0);

        db.ImportJobs.AddRange(first, second);
        db.StagingRows.AddRange(
            Row(first, "A-100", ("Name", "Legacy PDU"), ("Category", "Standard"), ("Unit", "PC")),
            Row(second, "A-100", ("Name", "Industrial PDU"), ("Category", "Standard"), ("Unit", "PC")));
        await db.SaveChangesAsync();

        var result = await new BusinessTraceService(db).SearchAsync(
            BusinessTraceService.PilotScopeKey,
            EntityType.Article,
            "A-100");

        Assert.NotNull(result);
        Assert.True(result.IsActive);
        Assert.Equal("Industrial PDU", result.DisplayName);
        Assert.Contains(result.CurrentFields, field => field.Key == "Name" && field.Value == "Industrial PDU");
        Assert.Equal("Nina Preparer", result.Responsibility.Prepared!.DisplayName);
        Assert.Equal("Adam Approver", result.Responsibility.Approved!.DisplayName);
        Assert.Equal("Paula Publisher", result.Responsibility.Published!.DisplayName);
        Assert.True(result.Responsibility.ApprovalEvidencePreserved);
        Assert.Contains(result.Events, item =>
            item.Changes.Any(change => change.Field == "Article name" &&
                                       change.Before == "Legacy PDU" &&
                                       change.After == "Industrial PDU"));
        Assert.Contains(result.Events, item => item.Decision == "Approved impact: 0 new, 1 modified, and 0 scoped removals.");
    }

    [Fact]
    public async Task SearchAsync_KeepsRemovedArticleHistoryWithoutShowingItAsActive()
    {
        await using var db = CreateDb();
        var introduced = PublishedJob(EntityType.Article, "articles-full.xlsx", new DateTime(2025, 1, 10, 9, 0, 0, DateTimeKind.Utc));
        var removed = PublishedJob(EntityType.Article, "articles-reduced.xlsx", new DateTime(2026, 1, 12, 10, 0, 0, DateTimeKind.Utc));
        db.ImportJobs.AddRange(introduced, removed);
        db.StagingRows.AddRange(
            Row(introduced, "A-REMOVED", ("Name", "Retired PDU")),
            Row(removed, "A-KEPT", ("Name", "Current PDU")));
        await db.SaveChangesAsync();

        var result = await new BusinessTraceService(db).SearchAsync(
            BusinessTraceService.PilotScopeKey,
            EntityType.Article,
            "A-REMOVED");

        Assert.NotNull(result);
        Assert.False(result.IsActive);
        Assert.Equal("Not active in CPQ", result.StatusLabel);
        Assert.Contains(result.Events, item => item.Kind == "introduced");
        Assert.Contains(result.Events, item => item.Kind == "removed");
    }

    [Fact]
    public async Task SearchAsync_GroupsCoordinatedReleaseIntoOnePublicationEvent()
    {
        await using var db = CreateDb();
        var publishedAt = new DateTime(2026, 2, 2, 11, 0, 0, DateTimeKind.Utc);
        var package = new ReleasePackage
        {
            Name = "Annual PDU 2026",
            Status = ReleasePackageStatus.Published,
            CreatedBy = "preparer-id",
            CreatedByDisplayName = "Nina Preparer",
            PublishedAt = publishedAt,
            PublishedByDisplayName = "Paula Publisher"
        };
        var article = PublishedJob(EntityType.Article, "articles.xlsx", publishedAt);
        var prices = PublishedJob(EntityType.PriceList, "prices.xlsx", publishedAt);
        article.ReleasePackage = package;
        prices.ReleasePackage = package;

        db.ReleasePackages.Add(package);
        db.ImportJobs.AddRange(article, prices);
        db.StagingRows.AddRange(
            Row(article, "A-200", ("Name", "Rack PDU"), ("Unit", "PC")),
            Row(prices, "A-200", ("UnitPrice", "42.50"), ("Currency", "EUR")));
        await db.SaveChangesAsync();

        var result = await new BusinessTraceService(db).SearchAsync(
            BusinessTraceService.PilotScopeKey,
            EntityType.Article,
            "A-200");

        Assert.NotNull(result);
        var publication = Assert.Single(result.Events, item => item.Category == "changes");
        Assert.Equal("Article introduced into the governed portfolio", publication.Title);
        Assert.Equal(package.Id, publication.ReleasePackageId);
        Assert.Equal("Annual PDU 2026", publication.ReleaseName);
        Assert.Contains("articles", publication.SourceName);
        Assert.Contains("prices", publication.SourceName);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"business-trace-{Guid.NewGuid():N}")
            .Options;
        return new AppDbContext(options);
    }

    private static ImportJob PublishedJob(EntityType type, string fileName, DateTime committedAt)
        => new()
        {
            FileName = fileName,
            OriginalFileName = fileName,
            EntityType = type,
            Status = ImportStatus.Committed,
            WorkflowStage = ImportWorkflowStage.Published,
            CreatedBy = "preparer-id",
            CreatedByDisplayName = "Default Preparer",
            CreatedAt = committedAt.AddHours(-1),
            CommittedAt = committedAt,
            CommittedBy = "Default Publisher"
        };

    private static StagingRow Row(ImportJob job, string articleNumber, params (string Key, string Value)[] values)
    {
        var fields = new Dictionary<string, string?> { ["ArticleNumber"] = articleNumber };
        foreach (var (key, value) in values)
            fields[key] = value;
        return new StagingRow
        {
            ImportJob = job,
            RowNumber = 2,
            RawData = JsonSerializer.Serialize(fields)
        };
    }

    private static string ApprovalSnapshot(ImportJob job, int added, int modified, int removed)
    {
        var comparison = new ImportComparisonResult(
            job.Id,
            Guid.NewGuid(),
            job.EntityType,
            "Article Master",
            true,
            1,
            added,
            modified,
            1 - added - modified,
            removed,
            [],
            []);
        return JsonSerializer.Serialize(new ApprovedComparisonSnapshot(
            1,
            job.ApprovedAt ?? job.CommittedAt!.Value,
            "approver-id",
            job.ApprovedByDisplayName ?? "Approver",
            comparison));
    }
}
