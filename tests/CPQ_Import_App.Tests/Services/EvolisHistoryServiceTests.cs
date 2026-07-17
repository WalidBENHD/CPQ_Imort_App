using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Infrastructure.Data;
using CPQ_Import_App.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Tests.Services;

public class EvolisHistoryServiceTests
{
    [Fact]
    public async Task History_IsScopedByUser_AndMetricsReflectOutcomes()
    {
        await using var db = CreateDb();
        var service = new EvolisHistoryService(db);
        var successful = await service.StartAsync("one.txt", 120, new string('A', 64), "user-1", "User One");
        var failed = await service.StartAsync("two.txt", 240, new string('B', 64), "user-2", "User Two");

        await service.CompleteAsync(successful.Id, "PDF");
        await service.FailAsync(failed.Id, "Invalid encrypted row.");

        var personal = await service.GetPagedAsync("user-1", 1, 20, null, null);
        var globalMetrics = await service.GetMetricsAsync(null);
        var personalMetrics = await service.GetMetricsAsync("user-1");

        Assert.Single(personal.Items);
        Assert.Equal("one.txt", personal.Items[0].FileName);
        Assert.Equal(2, globalMetrics.Total);
        Assert.Equal(1, globalMetrics.Successful);
        Assert.Equal(1, globalMetrics.Failed);
        Assert.Equal(1, personalMetrics.Total);
        Assert.Equal(0, personalMetrics.Failed);
    }

    [Fact]
    public async Task FailureReason_IsSafelyTruncated()
    {
        await using var db = CreateDb();
        var service = new EvolisHistoryService(db);
        var run = await service.StartAsync("bad.txt", 12, new string('C', 64), "user", "User");

        await service.FailAsync(run.Id, new string('x', 1200));

        var stored = await db.EvolisDecryptionRuns.SingleAsync();
        Assert.Equal(EvolisDecryptionStatus.Failed, stored.Status);
        Assert.Equal(1000, stored.FailureReason!.Length);
        Assert.NotNull(stored.CompletedAtUtc);
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"evolis-history-{Guid.NewGuid():N}")
            .Options;
        return new AppDbContext(options);
    }
}
