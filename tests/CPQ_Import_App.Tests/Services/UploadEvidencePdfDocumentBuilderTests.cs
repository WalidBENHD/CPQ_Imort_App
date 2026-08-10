using CPQ_Import_App.API.Services;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using QuestPDF.Infrastructure;

namespace CPQ_Import_App.Tests.Services;

public sealed class UploadEvidencePdfDocumentBuilderTests
{
    [Fact]
    public void Build_CreatesPublishedCoordinatedReleaseEvidencePdf()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var articleJobId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var priceJobId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var releaseId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var baselineId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var uploadedAt = new DateTime(2026, 8, 5, 8, 15, 0, DateTimeKind.Utc);
        var approvedAt = uploadedAt.AddHours(3);
        var publishedAt = approvedAt.AddHours(1);

        var job = new ImportJob
        {
            Id = articleJobId,
            FileName = "Articles_PDU_2027.xlsx",
            OriginalFileName = "Articles_PDU_2027.xlsx",
            EntityType = EntityType.Article,
            Status = ImportStatus.Committed,
            WorkflowStage = ImportWorkflowStage.Published,
            CreatedBy = "uploader-id",
            CreatedByDisplayName = "Data Contributor",
            CreatedAt = uploadedAt,
            SubmittedAt = uploadedAt.AddHours(2),
            SubmittedByDisplayName = "Data Contributor",
            ApprovedAt = approvedAt,
            ApprovedByUserId = "approver-id",
            ApprovedByDisplayName = "Business Approver",
            CommittedAt = publishedAt,
            CommittedBy = "Publication Owner",
            TotalRows = 325,
            ValidRows = 325,
            WarningRows = 0,
            ErrorRows = 0,
            CommittedRows = 325,
            ReleasePackageId = releaseId,
            ValidationAnchorKind = ValidationAnchorKind.ReleaseCandidate,
            ValidationAnchorJobId = articleJobId,
            ValidationAnchorPinnedAt = uploadedAt.AddHours(1)
        };

        var changedRows = Enumerable.Range(1, 22).Select(index =>
            new ComparisonRowResult(
                Guid.NewGuid(),
                index,
                $"1_PDU{index:0000}",
                index % 3 == 0 ? "New" : "Modified",
                2,
                [
                    new ComparisonFieldChange("Name", $"Approved article {index}", $"Previous article {index}", true),
                    new ComparisonFieldChange("Unit", "PC", index % 2 == 0 ? "EA" : "PC", index % 2 == 0)
                ])).ToList();
        var removals = Enumerable.Range(1, 8).Select(index =>
            new ComparisonMissingItem(
                $"1_OLD{index:0000}",
                new Dictionary<string, string?>
                {
                    ["ArticleNumber"] = $"1_OLD{index:0000}",
                    ["Name"] = $"Retired article {index}",
                    ["Category"] = "Standard",
                    ["Unit"] = "PC"
                })).ToList();
        var comparison = new ImportComparisonResult(
            articleJobId,
            baselineId,
            EntityType.Article,
            "Article Master",
            true,
            325,
            7,
            15,
            295,
            8,
            changedRows,
            removals);
        var approval = new ApprovedComparisonSnapshot(
            1,
            approvedAt,
            "approver-id",
            "Business Approver",
            comparison);
        var release = new ReleasePackageSummary(
            releaseId,
            "Annual PDU 2027",
            ReleasePackageStatus.Published,
            "uploader-id",
            "Data Contributor",
            uploadedAt,
            uploadedAt.AddHours(2),
            "Data Contributor",
            approvedAt,
            "Business Approver",
            null,
            null,
            null,
            publishedAt,
            "Publication Owner",
            null,
            [
                new ReleasePackageItemSummary(articleJobId, EntityType.Article, "Article Master", "Articles_PDU_2027.xlsx",
                    ImportStatus.Committed, ImportWorkflowStage.Published, 325, 0, true),
                new ReleasePackageItemSummary(priceJobId, EntityType.PriceList, "Basis Price", "Prices_PDU_2027.xlsx",
                    ImportStatus.Committed, ImportWorkflowStage.Published, 325, 0, false)
            ]);

        var pdf = new UploadEvidencePdfDocumentBuilder().Build(job, approval, release, "Evidence Reviewer");

        var samplePath = Environment.GetEnvironmentVariable("CPQ_UPLOAD_REPORT_SAMPLE_PATH");
        if (!string.IsNullOrWhiteSpace(samplePath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(samplePath)!);
            File.WriteAllBytes(samplePath, pdf);
        }

        Assert.True(pdf.Length > 15_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
    }

    [Fact]
    public void Build_AllowsLegacyIndividualPublicationWithoutApprovalSnapshot()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var job = new ImportJob
        {
            Id = Guid.NewGuid(),
            OriginalFileName = "Legacy_Prices.xlsx",
            EntityType = EntityType.PriceList,
            Status = ImportStatus.Committed,
            WorkflowStage = ImportWorkflowStage.Published,
            CreatedByDisplayName = "Legacy User",
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            CommittedAt = DateTime.UtcNow.AddDays(-29),
            CommittedBy = "Publication Owner",
            TotalRows = 10,
            ValidRows = 10,
            CommittedRows = 10
        };

        var pdf = new UploadEvidencePdfDocumentBuilder().Build(job, null, null, "Evidence Reviewer");

        Assert.True(pdf.Length > 8_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
