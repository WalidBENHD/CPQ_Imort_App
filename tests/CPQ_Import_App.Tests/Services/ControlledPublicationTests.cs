using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Parsers;
using CPQ_Import_App.Infrastructure.Services;
using OfficeOpenXml;

namespace CPQ_Import_App.Tests.Services;

public class ControlledPublicationTests
{
    [Fact]
    public async Task CopyToWorkspaceAsync_CreatesIndependentPrivateSnapshot()
    {
        var source = CreateJob(ImportStatus.Committed);
        source.WorkflowStage = ImportWorkflowStage.Published;
        source.OriginalFileName = "published.xlsx";
        var repository = new FakeImportRepository(source, CreateComparison(Guid.NewGuid(), true))
        {
            UploadedContent = [1, 2, 3]
        };
        repository.Rows.AddRange([
            new StagingRow { ImportJobId = source.Id, RowNumber = 1, Status = RowStatus.Valid, RawData = "{\"ArticleNumber\":\"A-1\"}", IsUserModified = true },
            new StagingRow { ImportJobId = source.Id, RowNumber = 2, Status = RowStatus.Warning, RawData = "{\"ArticleNumber\":\"A-2\"}" },
            new StagingRow { ImportJobId = source.Id, RowNumber = 3, Status = RowStatus.Valid, RawData = "{\"ArticleNumber\":\"A-3\"}", IsDeleted = true }
        ]);
        var service = CreateService(repository, new FakeCommitStrategy());

        var copy = await service.CopyToWorkspaceAsync(source.Id, "published - Working Copy", "new-owner", "Nina Owner");

        Assert.Equal(ImportWorkflowStage.Private, copy.WorkflowStage);
        Assert.Equal(ImportStatus.AwaitingApproval, copy.Status);
        Assert.Equal("new-owner", copy.CreatedBy);
        Assert.Equal("published - Working Copy.xlsx", copy.OriginalFileName);
        Assert.Equal(2, copy.TotalRows);
        Assert.NotEqual(source.Id, copy.Id);
        Assert.Equal([1, 2, 3], repository.CopiedContent);
        Assert.All(repository.CopiedRows, row =>
        {
            Assert.Equal(copy.Id, row.ImportJobId);
            Assert.False(row.IsUserAdded);
            Assert.False(row.IsUserModified);
            Assert.False(row.IsDeleted);
        });
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "CopiedToWorkspace" && entry.Details!.Contains(source.Id.ToString()));
    }

    [Fact]
    public async Task CopyToWorkspaceAsync_PreservesDependencyValidationAnchor()
    {
        var anchorId = Guid.NewGuid();
        var source = CreateJob(ImportStatus.Committed);
        source.WorkflowStage = ImportWorkflowStage.Published;
        source.ValidationAnchorJobId = anchorId;
        source.ValidationAnchorKind = ValidationAnchorKind.ExplicitVersion;
        source.ValidationAnchorPinnedAt = DateTime.UtcNow.AddDays(-2);
        var repository = new FakeImportRepository(source, CreateComparison(Guid.NewGuid(), true)) { UploadedContent = [1] };
        repository.Rows.Add(new StagingRow { ImportJobId = source.Id, RowNumber = 1, RawData = "{}" });
        var service = CreateService(repository, new FakeCommitStrategy());

        var copy = await service.CopyToWorkspaceAsync(source.Id, "copy.xlsx", "new-owner", "New Owner");

        Assert.Equal(anchorId, copy.ValidationAnchorJobId);
        Assert.Equal(ValidationAnchorKind.ExplicitVersion, copy.ValidationAnchorKind);
        Assert.Equal(source.ValidationAnchorPinnedAt, copy.ValidationAnchorPinnedAt);
    }

    [Theory]
    [InlineData("Annual Article List", "Annual Article List.xlsx")]
    [InlineData("Annual Article List.xlsx", "Annual Article List.xlsx")]
    public async Task RenameUploadAsync_PreservesFileExtension(string requestedName, string expectedName)
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true));
        var service = CreateService(repository, new FakeCommitStrategy());

        var renamed = await service.RenameUploadAsync(job.Id, requestedName, job.CreatedBy, job.CreatedByDisplayName);

        Assert.Equal(expectedName, renamed.OriginalFileName);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "Renamed");
    }

    [Fact]
    public async Task RenameUploadAsync_RejectsUploadOutsidePrivateWorkspace()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        job.WorkflowStage = ImportWorkflowStage.Submitted;
        var service = CreateService(
            new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true)),
            new FakeCommitStrategy());

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RenameUploadAsync(job.Id, "Renamed", job.CreatedBy, job.CreatedByDisplayName));
    }

    [Fact]
    public async Task RenameUploadAsync_RejectsDuplicateVisibleNameAcrossSystem()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var existing = CreateJob(ImportStatus.AwaitingApproval);
        existing.OriginalFileName = "Existing name.csv";
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(existing);
        var service = CreateService(repository, new FakeCommitStrategy());

        var error = await Assert.ThrowsAsync<InvalidDataException>(
            () => service.RenameUploadAsync(job.Id, "existing NAME", job.CreatedBy, job.CreatedByDisplayName));

        Assert.Contains("already exists", error.Message);
    }

    [Fact]
    public async Task CreateReleasePackageAsync_RejectsDuplicateNameAcrossSystem()
    {
        var priceJob = CreatePriceJob();
        var master = CreateJob(ImportStatus.AwaitingApproval);
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(master);
        repository.ReleasePackages.Add(new ReleasePackage { Name = "Annual 2027", CreatedBy = "another-user" });
        var service = CreateService(repository, new FakeCommitStrategy());

        var error = await Assert.ThrowsAsync<InvalidDataException>(() => service.CreateReleasePackageAsync(
            priceJob.Id, master.Id, " annual 2027 ", priceJob.CreatedBy, priceJob.CreatedByDisplayName));

        Assert.Contains("already exists", error.Message);
    }

    [Fact]
    public async Task ApplyDependencyAnchorAsync_RevalidatesPriceRowsAgainstSelectedMaster()
    {
        var priceJob = CreatePriceJob();
        var master = CreateJob(ImportStatus.Committed);
        master.EntityType = EntityType.Article;
        master.WorkflowStage = ImportWorkflowStage.Published;
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(master);
        repository.ArticleNumbers[master.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        repository.Rows.AddRange([
            PriceRow(priceJob.Id, 2, "A-1"),
            PriceRow(priceJob.Id, 3, "A-2")
        ]);
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        var result = await service.ApplyDependencyAnchorAsync(priceJob.Id, master.Id, "contributor-id", "Cara Contributor");

        Assert.Equal(master.Id, result.ValidationAnchorJobId);
        Assert.Equal(ValidationAnchorKind.ExplicitVersion, result.ValidationAnchorKind);
        Assert.Equal(1, result.ErrorRows);
        Assert.Contains(repository.Rows, row => row.Status == RowStatus.Error && row.ValidationMessages!.Contains("A-2"));
    }

    [Fact]
    public async Task CreateReleasePackageAsync_AnchorsDependentDraftToPrivateMasterCandidate()
    {
        var priceJob = CreatePriceJob();
        var master = CreateJob(ImportStatus.AwaitingApproval);
        master.EntityType = EntityType.Article;
        master.TotalRows = 1;
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(master);
        repository.ArticleNumbers[master.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        repository.Rows.Add(PriceRow(priceJob.Id, 2, "A-1"));
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        var package = await service.CreateReleasePackageAsync(
            priceJob.Id, master.Id, "Annual 2027", "contributor-id", "Cara Contributor");

        Assert.Equal("Annual 2027", package.Name);
        Assert.Equal(master.Id, priceJob.ValidationAnchorJobId);
        Assert.Equal(ValidationAnchorKind.ReleaseCandidate, priceJob.ValidationAnchorKind);
        Assert.Equal(priceJob.ReleasePackageId, master.ReleasePackageId);
        Assert.Equal(2, package.Items.Count);
    }

    [Fact]
    public async Task CreateReleasePackageFromArticleAsync_PairsPrivatePriceCandidateAndClearsDependencyErrors()
    {
        var articleJob = CreateJob(ImportStatus.NeedsCorrection);
        articleJob.ErrorRows = 1;
        var priceJob = CreatePriceJob();
        priceJob.Status = ImportStatus.NeedsCorrection;
        priceJob.ErrorRows = 1;
        var repository = new FakeImportRepository(articleJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(priceJob);
        repository.ArticleNumbers[articleJob.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        repository.Rows.Add(new StagingRow
        {
            ImportJobId = articleJob.Id,
            RowNumber = 2,
            Status = RowStatus.Error,
            RawData = ArticleRow("A-1"),
            ValidationMessages = "[{\"field\":\"ArticleNumber\",\"message\":\"Article 'A-1' has no matching price in the active Price List.\",\"severity\":2}]"
        });
        var priceRow = PriceRow(priceJob.Id, 2, "A-1");
        priceRow.Status = RowStatus.Error;
        priceRow.ValidationMessages = "[{\"field\":\"ArticleNumber\",\"message\":\"No Article Master was available when this row was checked.\",\"severity\":2}]";
        repository.Rows.Add(priceRow);
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        var package = await service.CreateReleasePackageFromArticleAsync(
            articleJob.Id, priceJob.Id, "Annual 2027", "contributor-id", "Cara Contributor");

        Assert.Equal("Annual 2027", package.Name);
        Assert.Equal(articleJob.ReleasePackageId, priceJob.ReleasePackageId);
        Assert.Equal(articleJob.Id, priceJob.ValidationAnchorJobId);
        Assert.Equal(ValidationAnchorKind.ReleaseCandidate, priceJob.ValidationAnchorKind);
        Assert.Equal(0, articleJob.ErrorRows);
        Assert.Equal(0, priceJob.ErrorRows);
        Assert.Equal(2, package.Items.Count);
    }

    [Fact]
    public async Task GetPriceListCandidatesAsync_AllowsErrorsResolvedBySelectedArticleMaster()
    {
        var articleJob = CreateJob(ImportStatus.NeedsCorrection);
        var priceJob = CreatePriceJob();
        priceJob.Status = ImportStatus.NeedsCorrection;
        priceJob.ErrorRows = 1;
        var repository = new FakeImportRepository(articleJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(priceJob);
        repository.ArticleNumbers[articleJob.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        var priceRow = PriceRow(priceJob.Id, 2, "A-1");
        priceRow.RawData = priceRow.RawData.Replace("10.00", string.Empty, StringComparison.Ordinal);
        priceRow.Status = RowStatus.Error;
        priceRow.ValidationMessages = "[{\"field\":\"UnitPrice\",\"message\":\"'UnitPrice' is required.\",\"severity\":2}]";
        repository.Rows.Add(priceRow);
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        var candidates = await service.GetPriceListCandidatesAsync(articleJob.Id, "contributor-id");

        var candidate = Assert.Single(candidates);
        Assert.True(candidate.IsEligible);
        Assert.Equal(1, candidate.MatchedArticles);
        Assert.Equal(0, candidate.ArticlesWithoutPrices);
        Assert.Equal(0, candidate.PricesWithoutArticles);
        Assert.Null(candidate.IneligibleReason);
    }

    [Fact]
    public async Task GetStagingRowsAsync_ArticleInReleaseKeepsPackagePriceContextAfterReload()
    {
        var packageId = Guid.NewGuid();
        var articleJob = CreateJob(ImportStatus.AwaitingApproval);
        articleJob.ReleasePackageId = packageId;
        var releasePrice = CreatePriceJob();
        releasePrice.ReleasePackageId = packageId;
        var activePrice = CreatePriceJob();
        activePrice.Status = ImportStatus.Committed;
        activePrice.WorkflowStage = ImportWorkflowStage.Published;
        activePrice.CommittedAt = DateTime.UtcNow;
        var articleRow = new StagingRow
        {
            ImportJobId = articleJob.Id,
            RowNumber = 2,
            Status = RowStatus.Valid,
            RawData = ArticleRow("A-1")
        };
        var repository = new FakeImportRepository(articleJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.AddRange([releasePrice, activePrice]);
        repository.Rows.AddRange([
            articleRow,
            PriceRow(releasePrice.Id, 2, "A-1"),
            PriceRow(activePrice.Id, 2, "OTHER")
        ]);
        repository.ReleasePackages.Add(new ReleasePackage
        {
            Id = packageId,
            Name = "Annual 2027",
            CreatedBy = "contributor-id",
            CreatedByDisplayName = "Cara Contributor"
        });
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        await service.GetStagingRowsAsync(articleJob.Id, 1, 50);

        Assert.Equal(RowStatus.Valid, articleRow.Status);
        Assert.Null(articleRow.ValidationMessages);
        Assert.Equal(0, articleJob.ErrorRows);
    }

    [Fact]
    public async Task GetStagingRowsAsync_PreservesDuplicateArticleErrorsAfterReload()
    {
        var articleJob = CreateJob(ImportStatus.NeedsCorrection);
        articleJob.TotalRows = 2;
        articleJob.ErrorRows = 2;
        var activePrice = CreatePriceJob();
        activePrice.Status = ImportStatus.Committed;
        activePrice.WorkflowStage = ImportWorkflowStage.Published;
        activePrice.CommittedAt = DateTime.UtcNow;

        const string duplicateMessages =
            "[{\"field\":\"ArticleNumber\",\"message\":\"ArticleNumber value 'A-1' is duplicated within the uploaded file.\",\"severity\":2}]";
        var firstDuplicate = new StagingRow { ImportJobId = articleJob.Id, RowNumber = 2, Status = RowStatus.Error, RawData = ArticleRow("A-1"), ValidationMessages = duplicateMessages };
        var secondDuplicate = new StagingRow { ImportJobId = articleJob.Id, RowNumber = 3, Status = RowStatus.Error, RawData = ArticleRow("A-1"), ValidationMessages = duplicateMessages };

        var repository = new FakeImportRepository(articleJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(activePrice);
        repository.Rows.AddRange([
            firstDuplicate,
            secondDuplicate,
            PriceRow(activePrice.Id, 2, "A-1")
        ]);
        var service = CreateService(repository, new FakeCommitStrategy());

        // Filtering by errors reloads the rows, which re-runs article validation.
        // Duplicate detection is cross-row and must survive the reload.
        await service.GetStagingRowsAsync(articleJob.Id, 1, 50, filterStatus: RowStatus.Error);

        Assert.Equal(RowStatus.Error, firstDuplicate.Status);
        Assert.Equal(RowStatus.Error, secondDuplicate.Status);
        Assert.Contains("is duplicated within the uploaded file", firstDuplicate.ValidationMessages);
        Assert.Contains("is duplicated within the uploaded file", secondDuplicate.ValidationMessages);
        Assert.Equal(2, articleJob.ErrorRows);
    }

    [Fact]
    public async Task CreateReleasePackageAsync_CopiesPublishedMasterWithoutChangingSource()
    {
        var priceJob = CreatePriceJob();
        var publishedMaster = CreateJob(ImportStatus.Committed);
        publishedMaster.WorkflowStage = ImportWorkflowStage.Published;
        publishedMaster.OriginalFileName = "published-master.xlsx";
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true))
        {
            UploadedContent = [1, 2, 3]
        };
        repository.AdditionalJobs.Add(publishedMaster);
        repository.Rows.Add(new StagingRow
        {
            ImportJobId = publishedMaster.Id,
            RowNumber = 2,
            RawData = "{\"ArticleNumber\":\"A-1\",\"Name\":\"Article\",\"Category\":\"Standard\",\"Unit\":\"PC\"}"
        });
        repository.Rows.Add(PriceRow(priceJob.Id, 2, "A-1"));
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        var package = await service.CreateReleasePackageAsync(
            priceJob.Id, publishedMaster.Id, "Annual 2027", "contributor-id", "Cara Contributor");

        var copiedMaster = Assert.Single(repository.AdditionalJobs, item =>
            item.Id != publishedMaster.Id && item.EntityType == EntityType.Article);
        Assert.Null(publishedMaster.ReleasePackageId);
        Assert.Equal(ImportWorkflowStage.Private, copiedMaster.WorkflowStage);
        Assert.Equal(copiedMaster.Id, priceJob.ValidationAnchorJobId);
        Assert.Equal(priceJob.ReleasePackageId, copiedMaster.ReleasePackageId);
        Assert.Equal(2, package.Items.Count);
    }

    [Fact]
    public async Task DissolveReleasePackageAsync_ReleasesMembersAndRepinsDependentDraft()
    {
        var packageId = Guid.NewGuid();
        var priceJob = CreatePriceJob();
        priceJob.ReleasePackageId = packageId;
        priceJob.ValidationAnchorKind = ValidationAnchorKind.ReleaseCandidate;
        var candidateMaster = CreateJob(ImportStatus.AwaitingApproval);
        candidateMaster.ReleasePackageId = packageId;
        priceJob.ValidationAnchorJobId = candidateMaster.Id;
        var activeMaster = CreateJob(ImportStatus.Committed);
        activeMaster.WorkflowStage = ImportWorkflowStage.Published;
        activeMaster.CommittedAt = DateTime.UtcNow;
        var activePrice = CreatePriceJob();
        activePrice.Status = ImportStatus.Committed;
        activePrice.WorkflowStage = ImportWorkflowStage.Published;
        activePrice.CommittedAt = DateTime.UtcNow;
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.AddRange([candidateMaster, activeMaster, activePrice]);
        repository.ReleasePackages.Add(new ReleasePackage
        {
            Id = packageId,
            Name = "Annual 2027",
            CreatedBy = "contributor-id",
            CreatedByDisplayName = "Cara Contributor"
        });
        repository.ArticleNumbers[activeMaster.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        repository.Rows.Add(PriceRow(priceJob.Id, 2, "A-1"));
        repository.Rows.Add(PriceRow(activePrice.Id, 2, "OTHER"));
        var candidateArticleRow = new StagingRow
        {
            ImportJobId = candidateMaster.Id,
            RowNumber = 2,
            Status = RowStatus.Valid,
            RawData = ArticleRow("A-1")
        };
        repository.Rows.Add(candidateArticleRow);
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        await service.DissolveReleasePackageAsync(
            packageId, "contributor-id", "Cara Contributor");

        Assert.Null(priceJob.ReleasePackageId);
        Assert.Null(candidateMaster.ReleasePackageId);
        Assert.Equal(activeMaster.Id, priceJob.ValidationAnchorJobId);
        Assert.Equal(ValidationAnchorKind.ActiveBaseline, priceJob.ValidationAnchorKind);
        Assert.Equal(RowStatus.Error, candidateArticleRow.Status);
        Assert.Equal(1, candidateMaster.ErrorRows);
        Assert.Contains("no matching price in the active Price List", candidateArticleRow.ValidationMessages);
        Assert.Empty(repository.ReleasePackages);
        Assert.Contains(repository.AuditLogs, log => log.Action == "ReleasePackageDissolved");
    }

    [Fact]
    public async Task WithdrawReleasePackageAsync_ReturnsEveryMemberToPrivateWorkspace()
    {
        var packageId = Guid.NewGuid();
        var priceJob = CreatePriceJob();
        priceJob.ReleasePackageId = packageId;
        priceJob.WorkflowStage = ImportWorkflowStage.Submitted;
        priceJob.SubmittedComparisonJson = "{}";
        var masterJob = CreateJob(ImportStatus.AwaitingApproval);
        masterJob.ReleasePackageId = packageId;
        masterJob.WorkflowStage = ImportWorkflowStage.Submitted;
        masterJob.SubmittedComparisonJson = "{}";
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(masterJob);
        repository.ReleasePackages.Add(new ReleasePackage
        {
            Id = packageId,
            Name = "Annual 2027",
            Status = ReleasePackageStatus.Submitted,
            CreatedBy = "contributor-id",
            CreatedByDisplayName = "Cara Contributor",
            SubmittedAt = DateTime.UtcNow,
            SubmittedByDisplayName = "Cara Contributor"
        });
        var service = CreateService(repository, new FakeCommitStrategy());

        var result = await service.WithdrawReleasePackageAsync(
            packageId, "contributor-id", "Cara Contributor");

        Assert.Equal(ReleasePackageStatus.Draft, result.Status);
        Assert.All(new[] { priceJob, masterJob }, job =>
        {
            Assert.Equal(ImportWorkflowStage.Private, job.WorkflowStage);
            Assert.NotNull(job.WithdrawnAt);
            Assert.Null(job.SubmittedComparisonJson);
            Assert.Equal(packageId, job.ReleasePackageId);
        });
        Assert.Equal(2, repository.AuditLogs.Count(log => log.Action == "ReleasePackageWithdrawn"));
    }

    [Fact]
    public async Task RejectReleasePackageAsync_RejectsEveryItemWithSharedReason()
    {
        var packageId = Guid.NewGuid();
        var master = CreateJob(ImportStatus.AwaitingApproval);
        master.WorkflowStage = ImportWorkflowStage.Submitted;
        master.ReleasePackageId = packageId;
        var price = CreatePriceJob();
        price.WorkflowStage = ImportWorkflowStage.Submitted;
        price.ReleasePackageId = packageId;
        var repository = new FakeImportRepository(master, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(price);
        repository.ReleasePackages.Add(new ReleasePackage
        {
            Id = packageId,
            Name = "Annual 2027",
            Status = ReleasePackageStatus.Submitted,
            CreatedBy = "contributor-id",
            CreatedByDisplayName = "Cara Contributor"
        });
        var service = CreateService(repository, new FakeCommitStrategy());

        var result = await service.RejectReleasePackageAsync(
            packageId, "approver-id", "Anne Approver", "Correct the prices and resubmit.");

        Assert.Equal(ReleasePackageStatus.Rejected, result.Status);
        Assert.Equal("Anne Approver", result.RejectedByDisplayName);
        Assert.Equal("Correct the prices and resubmit.", result.RejectionReason);
        Assert.All(new[] { master, price }, item =>
        {
            Assert.Equal(ImportStatus.Rejected, item.Status);
            Assert.Equal(ImportWorkflowStage.Rejected, item.WorkflowStage);
            Assert.Equal(result.RejectedAt, item.RejectedAt);
            Assert.Equal(result.RejectionReason, item.RejectionReason);
        });
        Assert.Equal(2, repository.AuditLogs.Count(log => log.Action == "ReleasePackageRejected"));
    }

    [Fact]
    public async Task RejectReleasePackageAsync_PreventsOwnerRejectingOwnRelease()
    {
        var packageId = Guid.NewGuid();
        var master = CreateJob(ImportStatus.AwaitingApproval);
        master.WorkflowStage = ImportWorkflowStage.Submitted;
        master.ReleasePackageId = packageId;
        var repository = new FakeImportRepository(master, CreateComparison(Guid.NewGuid(), true));
        repository.ReleasePackages.Add(new ReleasePackage
        {
            Id = packageId,
            Name = "Annual 2027",
            Status = ReleasePackageStatus.Submitted,
            CreatedBy = "contributor-id",
            CreatedByDisplayName = "Cara Contributor"
        });
        var service = CreateService(repository, new FakeCommitStrategy());

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.RejectReleasePackageAsync(
            packageId, "contributor-id", "Cara Contributor", "Changed my mind."));
    }

    [Fact]
    public async Task DeletePrivateDraftAsync_DissolvesPackageAndUnlocksSurvivingMaster()
    {
        var packageId = Guid.NewGuid();
        var priceJob = CreatePriceJob();
        priceJob.ReleasePackageId = packageId;
        var candidateMaster = CreateJob(ImportStatus.AwaitingApproval);
        candidateMaster.ReleasePackageId = packageId;
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(candidateMaster);
        repository.ReleasePackages.Add(new ReleasePackage
        {
            Id = packageId,
            Name = "Annual 2027",
            CreatedBy = "contributor-id",
            CreatedByDisplayName = "Cara Contributor"
        });
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        await service.DeletePrivateDraftAsync(
            priceJob.Id, "contributor-id", "Cara Contributor");

        Assert.Null(candidateMaster.ReleasePackageId);
        Assert.Empty(repository.ReleasePackages);
    }

    [Fact]
    public async Task CopyToWorkspaceAsync_RejectsPrivateSource()
    {
        var source = CreateJob(ImportStatus.AwaitingApproval);
        var service = CreateService(new FakeImportRepository(source, CreateComparison(Guid.NewGuid(), true)), new FakeCommitStrategy());

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CopyToWorkspaceAsync(source.Id, "copy.xlsx", "owner", "Owner"));
    }

    [Fact]
    public async Task SubmitForReviewAsync_FreezesComparisonAndSharesPrivateUpload()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var comparison = CreateComparison(Guid.NewGuid(), hasBaseline: true);
        var repository = new FakeImportRepository(job, comparison);
        var service = CreateService(repository, new FakeCommitStrategy());

        var result = await service.SubmitForReviewAsync(job.Id, "contributor-id", "Cara Contributor");

        Assert.Equal(ImportWorkflowStage.Submitted, result.WorkflowStage);
        Assert.NotNull(result.SubmittedAt);
        Assert.Equal("contributor-id", result.SubmittedByUserId);
        Assert.NotNull(result.SubmittedComparisonJson);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "Submitted");
    }

    [Fact]
    public async Task SubmitForReviewAsync_BlocksArticleMasterWhenItWouldLeaveOrphanPrices()
    {
        var articleJob = CreateJob(ImportStatus.AwaitingApproval);
        articleJob.TotalRows = 1;
        var activePrice = CreatePriceJob();
        activePrice.Status = ImportStatus.Committed;
        activePrice.WorkflowStage = ImportWorkflowStage.Published;
        activePrice.CommittedAt = DateTime.UtcNow;
        var repository = new FakeImportRepository(articleJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(activePrice);
        repository.ArticleNumbers[articleJob.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        repository.Rows.Add(PriceRow(activePrice.Id, 1, "A-1"));
        repository.Rows.Add(PriceRow(activePrice.Id, 2, "A-2"));
        var service = CreateService(repository, new FakeCommitStrategy());

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SubmitForReviewAsync(articleJob.Id, articleJob.CreatedBy, articleJob.CreatedByDisplayName));

        Assert.Contains("price reference(s) would point to missing articles", error.Message);
        Assert.Equal(ImportWorkflowStage.Private, articleJob.WorkflowStage);
    }

    [Fact]
    public async Task SubmitForReviewAsync_BlocksPriceListWhenAnActiveArticleHasNoPrice()
    {
        var priceJob = CreatePriceJob();
        var activeMaster = CreateJob(ImportStatus.Committed);
        activeMaster.WorkflowStage = ImportWorkflowStage.Published;
        activeMaster.CommittedAt = DateTime.UtcNow;
        var repository = new FakeImportRepository(priceJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(activeMaster);
        repository.ArticleNumbers[activeMaster.Id] = new HashSet<string>(["A-1", "A-2"], StringComparer.OrdinalIgnoreCase);
        repository.Rows.Add(PriceRow(priceJob.Id, 1, "A-1"));
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SubmitForReviewAsync(priceJob.Id, priceJob.CreatedBy, priceJob.CreatedByDisplayName));

        Assert.Contains("article(s) would have no price", error.Message);
        Assert.Equal(ImportWorkflowStage.Private, priceJob.WorkflowStage);
    }

    [Fact]
    public async Task RefreshValidationAsync_MarksArticleRowsWithoutActivePricesAsErrors()
    {
        var articleJob = CreateJob(ImportStatus.AwaitingApproval);
        var activePrice = CreatePriceJob();
        activePrice.Status = ImportStatus.Committed;
        activePrice.WorkflowStage = ImportWorkflowStage.Published;
        activePrice.CommittedAt = DateTime.UtcNow;
        var repository = new FakeImportRepository(articleJob, CreateComparison(Guid.NewGuid(), true));
        repository.AdditionalJobs.Add(activePrice);
        repository.Rows.AddRange([
            new StagingRow { ImportJobId = articleJob.Id, RowNumber = 2, Status = RowStatus.Valid, RawData = ArticleRow("A-1") },
            new StagingRow { ImportJobId = articleJob.Id, RowNumber = 3, Status = RowStatus.Valid, RawData = ArticleRow("A-2") },
            PriceRow(activePrice.Id, 1, "A-1")
        ]);
        var service = CreateService(repository, new FakeCommitStrategy());

        await service.RefreshValidationAsync(articleJob.Id, articleJob.CreatedBy, articleJob.CreatedByDisplayName);

        var missingPriceRow = Assert.Single(repository.Rows, row => row.ImportJobId == articleJob.Id && row.RowNumber == 3);
        Assert.Equal(RowStatus.Error, missingPriceRow.Status);
        Assert.Contains("no matching price in the active Price List", missingPriceRow.ValidationMessages);
        Assert.Equal(1, articleJob.ErrorRows);
    }

    [Fact]
    public async Task WithdrawFromReviewAsync_ReturnsSubmissionToPrivateWorkspace()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        job.WorkflowStage = ImportWorkflowStage.Submitted;
        job.SubmittedComparisonJson = JsonSerializer.Serialize(CreateComparison(Guid.NewGuid(), true));
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true));
        var service = CreateService(repository, new FakeCommitStrategy());

        var result = await service.WithdrawFromReviewAsync(job.Id, "contributor-id", "Cara Contributor");

        Assert.Equal(ImportWorkflowStage.Private, result.WorkflowStage);
        Assert.NotNull(result.WithdrawnAt);
        Assert.Null(result.SubmittedComparisonJson);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "Withdrawn");
    }

    [Fact]
    public async Task ApproveAsync_WhenApproverOwnsSubmission_BlocksSelfApproval()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var comparison = CreateComparison(Guid.NewGuid(), true);
        job.WorkflowStage = ImportWorkflowStage.Submitted;
        job.SubmittedComparisonJson = JsonSerializer.Serialize(comparison);
        var service = CreateService(new FakeImportRepository(job, comparison), new FakeCommitStrategy());

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ApproveAsync(job.Id, "contributor-id", "Cara Contributor"));

        Assert.Contains("own submission", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApproveAsync_PersistsApprovalEvidenceWithoutPublishing()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var comparison = CreateComparison(Guid.NewGuid(), hasBaseline: true);
        job.WorkflowStage = ImportWorkflowStage.Submitted;
        job.SubmittedComparisonJson = JsonSerializer.Serialize(comparison);
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
        Assert.Equal(ImportWorkflowStage.Submitted, result.WorkflowStage);
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
        Assert.Equal(ImportWorkflowStage.Published, result.WorkflowStage);
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

    [Fact]
    public async Task AddStagingRowAsync_FlagsArticleWhenNoActivePriceListExists()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true));
        var service = CreateService(repository, new FakeCommitStrategy());

        await service.AddStagingRowAsync(job.Id, new Dictionary<string, string?>
        {
            ["ArticleNumber"] = "A-NEW",
            ["Name"] = "New article",
            ["Category"] = "Standard",
            ["Unit"] = "PC"
        }, "contributor-id", "Cara Contributor");

        var row = Assert.Single(repository.Rows);
        Assert.True(row.IsUserAdded);
        Assert.False(row.IsDeleted);
        Assert.Equal(RowStatus.Error, row.Status);
        Assert.Contains("no matching price in the active Price List", row.ValidationMessages);
        Assert.Equal(1, job.TotalRows);
        Assert.Equal(1, job.ErrorRows);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "DraftRowAdded");
    }

    [Fact]
    public async Task CreateMaintenanceDraftAsync_ForPortfolioDataset_CopiesAndPairsBothActiveBaselines()
    {
        var articleBaseline = CreateJob(ImportStatus.Committed);
        articleBaseline.WorkflowStage = ImportWorkflowStage.Published;
        articleBaseline.CommittedAt = DateTime.UtcNow.AddDays(-1);
        var priceBaseline = CreatePriceJob();
        priceBaseline.Status = ImportStatus.Committed;
        priceBaseline.WorkflowStage = ImportWorkflowStage.Published;
        priceBaseline.CommittedAt = DateTime.UtcNow.AddDays(-1);
        var repository = new FakeImportRepository(articleBaseline, CreateComparison(articleBaseline.Id, true));
        repository.AdditionalJobs.Add(priceBaseline);
        repository.ArticleNumbers[articleBaseline.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        repository.Rows.Add(new StagingRow
        {
            ImportJobId = articleBaseline.Id,
            RowNumber = 2,
            RawData = "{\"ArticleNumber\":\"A-1\",\"Name\":\"Article\",\"Category\":\"Standard\",\"Unit\":\"PC\"}"
        });
        repository.Rows.Add(new StagingRow
        {
            ImportJobId = priceBaseline.Id,
            RowNumber = 2,
            RawData = "{\"ArticleNumber\":\"A-1\",\"UnitPrice\":\"0\",\"Currency\":\"EUR\",\"ValidFrom\":\"2026-01-01\"}"
        });
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        var result = await service.CreateMaintenanceDraftAsync(
            EntityType.Article, "January maintenance", "contributor-id", "Cara Contributor");

        Assert.NotNull(result.ReleasePackage);
        Assert.Equal(2, result.Jobs.Count);
        var articleDraft = Assert.Single(result.Jobs, item => item.EntityType == EntityType.Article);
        var priceDraft = Assert.Single(result.Jobs, item => item.EntityType == EntityType.PriceList);
        Assert.Equal(articleDraft.Id, priceDraft.ValidationAnchorJobId);
        Assert.Equal(ValidationAnchorKind.ReleaseCandidate, priceDraft.ValidationAnchorKind);
        Assert.Equal(result.ReleasePackage.Id, articleDraft.ReleasePackageId);
        Assert.Equal(result.ReleasePackage.Id, priceDraft.ReleasePackageId);
        Assert.All(result.Jobs, item => Assert.Equal(ImportWorkflowStage.Private, item.WorkflowStage));
        Assert.Equal(2, repository.CopiedRows.Count);
    }

    [Fact]
    public async Task AddStagingRowAsync_AllowsZeroBasisPrice()
    {
        var articleBaseline = CreateJob(ImportStatus.Committed);
        articleBaseline.WorkflowStage = ImportWorkflowStage.Published;
        var priceDraft = CreatePriceJob();
        priceDraft.ValidationAnchorJobId = articleBaseline.Id;
        priceDraft.ValidationAnchorKind = ValidationAnchorKind.ActiveBaseline;
        var repository = new FakeImportRepository(priceDraft, CreateComparison(articleBaseline.Id, true));
        repository.AdditionalJobs.Add(articleBaseline);
        repository.ArticleNumbers[articleBaseline.Id] = new HashSet<string>(["A-1"], StringComparer.OrdinalIgnoreCase);
        var service = new ImportService(repository, [new ArticleParser(), new PriceListParser()], [new FakeCommitStrategy()]);

        await service.AddStagingRowAsync(priceDraft.Id, new Dictionary<string, string?>
        {
            ["ArticleNumber"] = "A-1",
            ["UnitPrice"] = "0",
            ["Currency"] = "EUR",
            ["ValidFrom"] = "2026-01-01",
            ["ValidTo"] = null
        }, "contributor-id", "Cara Contributor");

        var row = Assert.Single(repository.Rows);
        Assert.Equal(RowStatus.Valid, row.Status);
        Assert.Null(row.ValidationMessages);
    }

    [Fact]
    public async Task DeleteAndRestoreStagingRowsAsync_PreservesRecoverableDraftEvidence()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var row = new StagingRow { ImportJobId = job.Id, RowNumber = 2, RawData = "{\"ArticleNumber\":\"A-1\",\"Name\":\"Article\",\"Category\":\"Standard\",\"Unit\":\"PC\"}" };
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true));
        repository.Rows.Add(row);
        var service = CreateService(repository, new FakeCommitStrategy());

        await service.DeleteStagingRowsAsync(job.Id, [row.Id], "contributor-id", "Cara Contributor");

        Assert.True(row.IsDeleted);
        Assert.NotNull(row.DeletedAt);
        Assert.Equal(0, job.TotalRows);

        await service.RestoreStagingRowsAsync(job.Id, [row.Id], "contributor-id", "Cara Contributor");

        Assert.False(row.IsDeleted);
        Assert.Null(row.DeletedAt);
        Assert.Equal(1, job.TotalRows);
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "DraftRowsDeleted");
        Assert.Contains(repository.AuditLogs, entry => entry.Action == "DraftRowsRestored");
    }

    [Fact]
    public async Task UpdateStagingRowAsync_MarksImportedRowAsUserModified()
    {
        var job = CreateJob(ImportStatus.AwaitingApproval);
        var row = new StagingRow { ImportJobId = job.Id, RowNumber = 2, RawData = "{}" };
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true));
        repository.Rows.Add(row);
        var service = CreateService(repository, new FakeCommitStrategy());

        await service.UpdateStagingRowAsync(job.Id, row.Id, new Dictionary<string, string?>
        {
            ["ArticleNumber"] = "A-1",
            ["Name"] = "Updated article",
            ["Category"] = "Standard",
            ["Unit"] = "PC"
        }, "contributor-id", "Cara Contributor");

        Assert.True(row.IsUserModified);
        Assert.False(row.IsUserAdded);
    }

    [Fact]
    public async Task GenerateWorkingCopyAsync_AppliesActiveRowsAndExcludesDeletedRows()
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var sourcePackage = new ExcelPackage();
        var sourceSheet = sourcePackage.Workbook.Worksheets.Add("Articles");
        sourceSheet.Cells[1, 1].Value = "ArticleNumber";
        sourceSheet.Cells[1, 2].Value = "Name";
        sourceSheet.Cells[2, 1].Value = "A-OLD";
        sourceSheet.Cells[2, 2].Value = "Old value";

        var job = CreateJob(ImportStatus.AwaitingApproval);
        var repository = new FakeImportRepository(job, CreateComparison(Guid.NewGuid(), true))
        {
            UploadedContent = sourcePackage.GetAsByteArray()
        };
        repository.Rows.Add(new StagingRow { ImportJobId = job.Id, RowNumber = 2, RawData = "{\"ArticleNumber\":\"A-EDITED\",\"Name\":\"Edited value\"}" });
        repository.Rows.Add(new StagingRow { ImportJobId = job.Id, RowNumber = 3, IsUserAdded = true, RawData = "{\"ArticleNumber\":\"A-ADDED\",\"Name\":\"Added value\"}" });
        repository.Rows.Add(new StagingRow { ImportJobId = job.Id, RowNumber = 4, IsDeleted = true, RawData = "{\"ArticleNumber\":\"A-DELETED\",\"Name\":\"Deleted value\"}" });
        var service = CreateService(repository, new FakeCommitStrategy());

        var workingCopy = await service.GenerateWorkingCopyAsync(job.Id, "contributor-id");

        using var exportedPackage = new ExcelPackage(new MemoryStream(workingCopy.Content));
        var exportedSheet = exportedPackage.Workbook.Worksheets.First();
        Assert.Equal("A-EDITED", exportedSheet.Cells[2, 1].Text);
        Assert.Equal("A-ADDED", exportedSheet.Cells[3, 1].Text);
        Assert.NotEqual("A-DELETED", exportedSheet.Cells[4, 1].Text);
        Assert.EndsWith("_working-copy.xlsx", workingCopy.FileName);
    }

    private static ImportService CreateService(FakeImportRepository repository, FakeCommitStrategy strategy)
        => new(repository, [new ArticleParser()], [strategy]);

    private static ImportJob CreateJob(ImportStatus status) => new()
    {
        Id = Guid.NewGuid(),
        OriginalFileName = "annual-articles.xlsx",
        EntityType = EntityType.Article,
        Status = status,
        WorkflowStage = ImportWorkflowStage.Private,
        CreatedBy = "contributor-id",
        CreatedByDisplayName = "Cara Contributor",
        TotalRows = 1,
        ErrorRows = 0
    };

    private static ImportJob CreateApprovedJob(ImportComparisonResult comparison)
    {
        var approvedAt = DateTime.UtcNow.AddMinutes(-5);
        var snapshot = new ApprovedComparisonSnapshot(1, approvedAt, "approver-id", "Anne Approver", comparison);
        var job = CreateJob(ImportStatus.Approved);
        job.WorkflowStage = ImportWorkflowStage.Approved;
        job.ApprovedAt = approvedAt;
        job.ApprovedByUserId = snapshot.ApprovedByUserId;
        job.ApprovedByDisplayName = snapshot.ApprovedByDisplayName;
        job.ApprovedComparisonJson = JsonSerializer.Serialize(snapshot);
        return job;
    }

    private static ImportJob CreatePriceJob() => new()
    {
        Id = Guid.NewGuid(),
        OriginalFileName = "annual-prices.xlsx",
        EntityType = EntityType.PriceList,
        Status = ImportStatus.AwaitingApproval,
        WorkflowStage = ImportWorkflowStage.Private,
        CreatedBy = "contributor-id",
        CreatedByDisplayName = "Cara Contributor",
        TotalRows = 2
    };

    private static StagingRow PriceRow(Guid jobId, int rowNumber, string articleNumber) => new()
    {
        ImportJobId = jobId,
        RowNumber = rowNumber,
        RawData = JsonSerializer.Serialize(new Dictionary<string, string?>
        {
            ["ArticleNumber"] = articleNumber,
            ["UnitPrice"] = "10.00",
            ["Currency"] = "EUR",
            ["ValidFrom"] = "2027-01-01",
            ["ValidTo"] = "2027-12-31"
        })
    };

    private static string ArticleRow(string articleNumber)
        => JsonSerializer.Serialize(new Dictionary<string, string?>
        {
            ["ArticleNumber"] = articleNumber,
            ["Name"] = "Article",
            ["Category"] = "Standard",
            ["Unit"] = "PC"
        });

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
        public byte[]? UploadedContent { get; init; }
        public byte[]? CopiedContent { get; private set; }
        public List<StagingRow> CopiedRows { get; } = [];
        public List<ImportJob> AdditionalJobs { get; } = [];
        public Dictionary<Guid, IReadOnlySet<string>> ArticleNumbers { get; } = [];
        public List<ReleasePackage> ReleasePackages { get; } = [];

        public Task<ImportJob?> GetJobAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult<ImportJob?>(id == job.Id ? job : AdditionalJobs.FirstOrDefault(item => item.Id == id));
        public Task<ImportJob?> GetJobSummaryAsync(Guid id, CancellationToken ct = default)
            => GetJobAsync(id, ct);

        public Task<bool> IsUploadNameInUseAsync(string fileName, Guid? excludingJobId = null, CancellationToken ct = default)
        {
            var visibleName = Path.GetFileNameWithoutExtension(fileName).Trim();
            var exists = new[] { job }.Concat(AdditionalJobs).Any(item =>
                item.Id != excludingJobId
                && string.Equals(Path.GetFileNameWithoutExtension(item.OriginalFileName).Trim(), visibleName, StringComparison.OrdinalIgnoreCase));
            return Task.FromResult(exists);
        }

        public Task<bool> IsReleaseNameInUseAsync(string name, Guid? excludingPackageId = null, CancellationToken ct = default)
            => Task.FromResult(ReleasePackages.Any(package =>
                package.Id != excludingPackageId
                && string.Equals(package.Name.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase)));

        public Task<ImportComparisonResult> GetComparisonAsync(Guid jobId, CancellationToken ct = default)
            => Task.FromResult(comparison);

        public Task<(IReadOnlyList<StagingRow> Items, int Total)> GetStagingRowsPagedAsync(
            Guid jobId, int page, int pageSize, string? search = null, RowStatus? filterStatus = null,
            ComparisonStatus? comparisonStatus = null, CancellationToken ct = default)
        {
            var activeRows = Rows.Where(row => !row.IsDeleted).ToList();
            return Task.FromResult(((IReadOnlyList<StagingRow>)activeRows, activeRows.Count));
        }

        public Task UpdateJobAsync(ImportJob updatedJob, CancellationToken ct = default) => Task.CompletedTask;

        public Task AddAuditLogAsync(AuditLog entry, CancellationToken ct = default)
        {
            AuditLogs.Add(entry);
            return Task.CompletedTask;
        }

        public Task<ImportJob> CreateJobAsync(ImportJob newJob, CancellationToken ct = default) => Task.FromResult(newJob);
        public Task<ImportJob> CreateCopiedJobAsync(ImportJob newJob, IReadOnlyCollection<StagingRow> rows, string uploadedFileName, byte[] uploadedFileContent, AuditLog auditLog, CancellationToken ct = default)
        {
            CopiedRows.AddRange(rows);
            Rows.AddRange(rows);
            AdditionalJobs.Add(newJob);
            if (newJob.EntityType == EntityType.Article)
            {
                ArticleNumbers[newJob.Id] = rows
                    .Select(row => JsonSerializer.Deserialize<Dictionary<string, string?>>(row.RawData ?? "{}"))
                    .Select(values => values?.GetValueOrDefault("ArticleNumber"))
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value!)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
            }
            CopiedContent = uploadedFileContent;
            AuditLogs.Add(auditLog);
            return Task.FromResult(newJob);
        }
        public Task<ImportJob> CreateDraftSnapshotAsync(ImportJob newJob, IReadOnlyCollection<StagingRow> rows, AuditLog auditLog, CancellationToken ct = default)
        {
            CopiedRows.AddRange(rows);
            Rows.AddRange(rows);
            AdditionalJobs.Add(newJob);
            AuditLogs.Add(auditLog);
            if (newJob.EntityType == EntityType.Article)
            {
                ArticleNumbers[newJob.Id] = rows
                    .Select(row => JsonSerializer.Deserialize<Dictionary<string, string?>>(row.RawData ?? "{}"))
                    .Select(values => values?.GetValueOrDefault("ArticleNumber"))
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value!)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
            }
            return Task.FromResult(newJob);
        }
        public Task<(IReadOnlyList<ImportJob> Items, int Total)> GetJobsPagedAsync(int page, int pageSize, string viewerUserId, string? search = null, ImportStatus? status = null, EntityType? entityType = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task DeleteJobAsync(ImportJob deletedJob, CancellationToken ct = default) => Task.CompletedTask;
        public Task AddStagingRowsAsync(IEnumerable<StagingRow> rows, CancellationToken ct = default)
        {
            Rows.AddRange(rows);
            return Task.CompletedTask;
        }
        public Task<IReadOnlyList<StagingRow>> GetStagingRowsByJobAsync(Guid jobId, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<StagingRow>>(Rows.Where(row => row.ImportJobId == jobId && !row.IsDeleted).ToList());
        public Task<IReadOnlyList<StagingRow>> GetDeletedStagingRowsByJobAsync(Guid jobId, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<StagingRow>>(Rows.Where(row => row.ImportJobId == jobId && row.IsDeleted).ToList());
        public Task<StagingRow?> GetStagingRowAsync(Guid jobId, Guid rowId, CancellationToken ct = default) => Task.FromResult<StagingRow?>(Rows.FirstOrDefault(row => row.ImportJobId == jobId && row.Id == rowId));
        public Task UpdateStagingRowAsync(StagingRow row, CancellationToken ct = default) => Task.CompletedTask;
        public Task SaveChangesAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<IReadOnlySet<string>> GetLatestApprovedArticleNumbersAsync(CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlySet<string>> GetArticleNumbersForJobAsync(Guid articleJobId, CancellationToken ct = default)
            => Task.FromResult(ArticleNumbers.TryGetValue(articleJobId, out var values)
                ? values
                : (IReadOnlySet<string>)new HashSet<string>(StringComparer.OrdinalIgnoreCase));
        public Task<ImportJob?> GetLatestCommittedJobAsync(EntityType entityType, CancellationToken ct = default)
            => Task.FromResult<ImportJob?>(new[] { job }.Concat(AdditionalJobs)
                .Where(item => item.EntityType == entityType && item.Status == ImportStatus.Committed)
                .OrderByDescending(item => item.CommittedAt).FirstOrDefault());
        public Task<IReadOnlyList<ImportJob>> GetOwnedPrivateJobsAsync(string userId, EntityType? entityType = null, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ImportJob>>(new[] { job }.Concat(AdditionalJobs)
                .Where(item => item.CreatedBy == userId && item.WorkflowStage == ImportWorkflowStage.Private && (!entityType.HasValue || item.EntityType == entityType))
                .ToList());
        public Task<IReadOnlyList<ImportJob>> GetArticleMasterCandidatesAsync(string userId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ImportJob>>(new[] { job }.Concat(AdditionalJobs)
                .Where(item => item.EntityType == EntityType.Article
                    && ((item.WorkflowStage == ImportWorkflowStage.Private && item.CreatedBy == userId)
                        || item.WorkflowStage is ImportWorkflowStage.Submitted
                            or ImportWorkflowStage.Approved
                            or ImportWorkflowStage.Published))
                .ToList());
        public Task<IReadOnlyList<ImportJob>> GetPriceListCandidatesAsync(string userId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ImportJob>>(new[] { job }.Concat(AdditionalJobs)
                .Where(item => item.EntityType == EntityType.PriceList
                    && ((item.WorkflowStage == ImportWorkflowStage.Private && item.CreatedBy == userId)
                        || item.WorkflowStage is ImportWorkflowStage.Submitted
                            or ImportWorkflowStage.Approved
                            or ImportWorkflowStage.Published))
                .ToList());
        public Task<ReleasePackage?> GetReleasePackageAsync(Guid packageId, CancellationToken ct = default)
        {
            var package = ReleasePackages.FirstOrDefault(item => item.Id == packageId);
            if (package is not null)
            {
                package.Jobs = new[] { job }.Concat(AdditionalJobs).Where(item => item.ReleasePackageId == packageId).ToList();
            }
            return Task.FromResult(package);
        }
        public Task<ReleasePackage?> GetReleasePackageSummaryAsync(Guid packageId, CancellationToken ct = default)
            => GetReleasePackageAsync(packageId, ct);
        public Task AddReleasePackageAsync(ReleasePackage package, CancellationToken ct = default)
        {
            ReleasePackages.Add(package);
            return Task.CompletedTask;
        }
        public Task DeleteReleasePackageAsync(ReleasePackage package, CancellationToken ct = default)
        {
            ReleasePackages.Remove(package);
            return Task.CompletedTask;
        }
        public Task<byte[]?> GetUploadedFileAsync(Guid jobId, CancellationToken ct = default) => Task.FromResult(UploadedContent);
        public Task SaveUploadedFileAsync(Guid jobId, string fileName, byte[] content, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
