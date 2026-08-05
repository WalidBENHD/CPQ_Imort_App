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
        var successful = await service.StartAsync("one.txt", 120, new string('A', 64), "text/plain", [1, 2], "user-1", "User One");
        var failed = await service.StartAsync("two.txt", 240, new string('B', 64), "text/plain", [3, 4], "user-2", "User Two");

        await service.CompleteAsync(successful.Id, "PDF", "decrypted result");
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
        Assert.True(personal.Items[0].HasSourceFile);
        Assert.True(personal.Items[0].HasResult);

        var retained = await service.GetByIdAsync(successful.Id);
        Assert.Equal(new byte[] { 1, 2 }, retained!.SourceFileContent);
        Assert.Equal("decrypted result", retained.DecryptedContent);
    }

    [Fact]
    public async Task FailureReason_IsSafelyTruncated()
    {
        await using var db = CreateDb();
        var service = new EvolisHistoryService(db);
        var run = await service.StartAsync("bad.txt", 12, new string('C', 64), "text/plain", [5], "user", "User");

        await service.FailAsync(run.Id, new string('x', 1200));

        var stored = await db.EvolisDecryptionRuns.SingleAsync();
        Assert.Equal(EvolisDecryptionStatus.Failed, stored.Status);
        Assert.Equal(1000, stored.FailureReason!.Length);
        Assert.NotNull(stored.CompletedAtUtc);
    }

    [Fact]
    public async Task Reset_RemovesOnlyEvolisHistory()
    {
        await using var db = CreateDb();
        var service = new EvolisHistoryService(db);
        await service.StartAsync("one.txt", 12, new string('A', 64), "text/plain", [1], "user", "User");
        await service.StartAsync("two.txt", 24, new string('B', 64), "text/plain", [2], "user", "User");

        var deleted = await service.ResetAsync();

        Assert.Equal(2, deleted);
        Assert.Empty(await db.EvolisDecryptionRuns.ToListAsync());
    }

    [Fact]
    public async Task PersonalRemoval_IsHiddenFromOwner_ButRetainedUntilAdminDeletion()
    {
        await using var db = CreateDb();
        var service = new EvolisHistoryService(db);
        var removedRun = await service.StartAsync("removed.txt", 12, new string('A', 64), "text/plain", [1], "user", "User");
        var activeRun = await service.StartAsync("active.txt", 24, new string('B', 64), "text/plain", [2], "user", "User");
        await service.CompleteAsync(removedRun.Id, "PDF", "removed result");
        await service.CompleteAsync(activeRun.Id, "PDF", "active result");

        Assert.True(await service.SoftDeleteAsync(removedRun.Id, "user", "User"));

        var personal = await service.GetPagedAsync("user", 1, 20, null, null);
        var admin = await service.GetPagedAsync(null, 1, 20, null, null, includeDeleted: true);
        var metrics = await service.GetMetricsAsync(null);

        Assert.Single(personal.Items);
        Assert.Equal(activeRun.Id, personal.Items[0].Id);
        Assert.Equal(2, admin.Total);
        Assert.Contains(admin.Items, item => item.Id == removedRun.Id && item.IsDeleted);
        Assert.Equal(1, metrics.Deleted);
        Assert.False(await service.PermanentlyDeleteAsync(activeRun.Id));
        Assert.True(await service.PermanentlyDeleteAsync(removedRun.Id));
        Assert.Null(await service.GetByIdAsync(removedRun.Id));
        Assert.NotNull(await service.GetByIdAsync(activeRun.Id));
    }

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"evolis-history-{Guid.NewGuid():N}")
            .Options;
        return new AppDbContext(options);
    }
}
