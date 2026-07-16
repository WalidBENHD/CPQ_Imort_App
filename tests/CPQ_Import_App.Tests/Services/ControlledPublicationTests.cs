using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Parsers;
using CPQ_Import_App.Infrastructure.Services;

namespace CPQ_Import_App.Tests.Services;

public class ControlledPublicationTests
{
    [Fact]
    public async Task ApproveAsync_PersistsApprovalEvidenceWithoutPublishing()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var comparison = CreateComparison(Guid.NewGuid(), hasBaseline: true);
        var repository = new FakeImportRepository(job, comparison);
        var strategy = new FakeCommitStrategy();
        var service = CreateService(repository, strategy);

        var result = await service.ApproveAsync(job.Id, "approver-id", "Anne Approver");

        Assert.Equal(ImportStatus.Approved, result.Status);
        Assert.NotNull(result.ApprovedAt);
        Assert.Equal("approver-id", result.ApprovedByUserId);
        Assert.Equal("Anne Approver", result.ApprovedByDisplayName);
        Assert.NotNull(result.ApprovedComparisonJson);
        Assert.Null(result.CommittedAt);
        Assert.False(strategy.WasCalled);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "Approved");
    }

    [Fact]
    public async Task ReturnToReviewAsync_ClearsApprovalEvidence()
    {
        var job = CreateApprovedJob(CreateComparison(Guid.NewGuid(), hasBaseline: true));
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), hasBaseline: true));
        var service = CreateService(repository, new FakeCommitStrategy());

        var result = await service.ReturnToReviewAsync(job.Id, "approver-id", "Anne Approver");

        Assert.Equal(ImportStatus.AwaitingApproval, result.Status);
        Assert.Null(result.ApprovedAt);
        Assert.Null(result.ApprovedByUserId);
        Assert.Null(result.ApprovedByDisplayName);
        Assert.Null(result.ApprovedComparisonJson);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "ApprovalReturned");
    }

    [Fact]
    public async Task PublishAsync_UsesApprovedScopedDeletionsAndRecordsPublisher()
    {
        var baselineId = Guid.NewGuid();
        var approvedComparison = CreateComparison(baselineId, hasBaseline: true);
        var job = CreateApprovedJob(approvedComparison);
        var repository = new FakeImportRepository(job, CreateComparison(baselineId, hasBaseline: true));
        repository.Rows.Add(new StagingRow
        {
            ImportJobId = job.Id,
            RowNumber = 1,
            Status = RowStatus.Valid,
            RawData = "{\"ArticleNumber\":\"A-NEW\"}"
        });
        var strategy = new FakeCommitStrategy();
        var service = CreateService(repository, strategy);

        var result = await service.PublishAsync(job.Id, "publisher-id", "Paul Publisher");

        Assert.Equal(ImportStatus.Committed, result.Status);
        Assert.Equal("Paul Publisher", result.CommittedBy);
        Assert.Equal(1, result.CommittedRows);
        Assert.True(strategy.WasCalled);
        Assert.Equal(["A-MISSING"], strategy.RemovedKeys);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "Published");
    }

    [Fact]
    public async Task PublishAsync_WhenBaselineChanged_BlocksStaleApproval()
    {
        var approvedComparison = CreateComparison(Guid.NewGuid(), hasBaseline: true);
        var job = CreateApprovedJob(approvedComparison);
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), hasBaseline: true));
        var strategy = new FakeCommitStrategy();
        var service = CreateService(repository, strategy);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.PublishAsync(job.Id, "publisher-id", "Paul Publisher"));

        Assert.Contains("active baseline changed", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(ImportStatus.Approved, job.Status);
        Assert.False(strategy.WasCalled);
    }

    private static ImportService CreateService(FakeImportRepository repository, FakeCommitStrategy strategy)
        => new(repository, Array.Empty<IFileParser>(), [strategy]);

    private static ImportJob CreateJob(ImportStatus status) => new()
    {
        Id = Guid.NewGuid(),
        OriginalFileName = "annual-articles.xlsx",
        EntityType = EntityType.Article,
        Status = status,
        ErrorRows = 0
    };

    private static ImportJob CreateApprovedJob(ImportComparisonResult comparison)
    {
        var approvedAt = DateTime.UtcNow.AddMinutes(-5);
        var snapshot = new ApprovedComparisonSnapshot(1, approvedAt, "approver-id", "Anne Approver", comparison);
        var job = CreateJob(ImportStatus.Approved);
        job.ApprovedAt = approvedAt;
        job.ApprovedByUserId = snapshot.ApprovedByUserId;
        job.ApprovedByDisplayName = snapshot.ApprovedByDisplayName;
        job.ApprovedComparisonJson = JsonSerializer.Serialize(snapshot);
        return job;
    }

    private static ImportComparisonResult CreateComparison(Guid baselineId, bool hasBaseline) => new(
        JobId: Guid.NewGuid(),
        BaselineJobId: baselineId,
        EntityType: EntityType.Article,
        EntityTypeLabel: "Article Master",
        HasBaseline: hasBaseline,
        ComparedRows: 1,
        NewRows: 1,
        ModifiedRows: 0,
        UnchangedRows: 0,
        MissingBaselineRows: hasBaseline ? 1 : 0,
        Rows: [],
        MissingRows: hasBaseline
            ? [new ComparisonMissingItem("A-MISSING", new Dictionary<string, string?>())]
            : []);

    private sealed class FakeCommitStrategy : ICpqCommitStrategy
    {
        public EntityType EntityType => EntityType.Article;
        public bool WasCalled { get; private set; }
        public IReadOnlyCollection<string> RemovedKeys { get; private set; } = [];

        public Task CommitRowsAsync(
            IEnumerable<Dictionary<string, string?>> rows,
            IReadOnlyCollection<string> removedKeys,
            CancellationToken ct = default)
        {
            WasCalled = true;
            RemovedKeys = removedKeys.ToArray();
            return Task.CompletedTask;
        }
    }

    private sealed class FakeImportRepository(ImportJob job, ImportComparisonResult comparison) : IImportRepository
    {
        public List<AuditLog> AuditLogs { get; } = [];
        public List<StagingRow> Rows { get; } = [];

        public Task<ImportJob?> GetJobAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult<ImportJob?>(id == job.Id ? job : null);

        public Task<ImportComparisonResult> GetComparisonAsync(Guid jobId, CancellationToken ct = default)
            => Task.FromResult(comparison);

        public Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsPagedAsync(
            Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null,
            ComparisonStatus? comparisonStatus = null, CancellationToken ct = default)
            => Task.FromResult(((IReadOnlyList<StagingRow>)Rows, Rows.Count));

        public Task UpdateJobAsync(ImportJob updatedJob, CancellationToken ct = default) => Task.CompletedTask;

        public Task AddAuditLogAsync(AuditLog entry, CancellationToken ct = default)
        {
            AuditLogs.Add(entry);
            return Task.CompletedTask;
        }

        public Task<ImportJob> CreateJobAsync(ImportJob newJob, CancellationToken ct = default) => Task.FromResult(newJob);
        public Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(int page, int pageSize, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task AddStagingRowsAsync(IEnumerable<StagingRow> rows, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<StagingRow>> GetStagingRowsByJobAsync(Guid jobId, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<StagingRow>>(Rows);
        public Task<StagingRow?> GetStagingRowAsync(Guid jobId, Guid rowId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task UpdateStagingRowAsync(StagingRow row, CancellationToken ct = default) => throw new NotSupportedException();
        public Task SaveChangesAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<IReadOnlySet<string>> GetLatestApprovedArticleNumbersAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<byte[]?> GetUploadedFileAsync(Guid jobId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task SaveUploadedFileAsync(Guid jobId, string fileName, byte[] content, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
