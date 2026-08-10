using CPQ_Import_App.API.Services;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using QuestPDF.Infrastructure;

namespace CPQ_Import_App.Tests.Services;

public sealed class BusinessTracePdfDocumentBuilderTests
{
    [Fact]
    public void Build_CreatesPdfWithCompleteEvidenceHistory()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var jobId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var trace = new BusinessTraceResult(
            new BusinessTraceScope("saint-marcellin-pdu", "Saint-Marcellin", "PDU", "Standard", "EUR"),
            EntityType.Article,
            "Article Master",
            "1_D001951AA",
            "PDU test article",
            true,
            "Active in CPQ",
            new DateTime(2026, 8, 1, 11, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 1, 9, 0, 0, DateTimeKind.Utc),
            [
                new BusinessTraceField("name", "Name", "PDU test article", "Commercial description", "Article Master", "text"),
                new BusinessTraceField("unit", "Unit", "PC", "Controlled unit", "Article Master", "text"),
                new BusinessTraceField("price", "Basis price", "42.75", "EUR", "Basis Price", "price")
            ],
            [new BusinessTraceSource(jobId, "Article Master", "Articles_PDU_2027.xlsx",
                new DateTime(2026, 8, 1, 11, 30, 0, DateTimeKind.Utc), null, "Annual 2027 release")],
            new BusinessTraceResponsibility(
                new BusinessTraceActor("Prepared by", "Data Contributor", new DateTime(2026, 8, 1, 9, 0, 0, DateTimeKind.Utc)),
                new BusinessTraceActor("Approved by", "Business Approver", new DateTime(2026, 8, 1, 10, 30, 0, DateTimeKind.Utc)),
                new BusinessTraceActor("Published by", "Publication Owner", new DateTime(2026, 8, 1, 11, 30, 0, DateTimeKind.Utc)),
                true),
            Enumerable.Range(0, 12).Select(index => new BusinessTraceEvent(
                $"event-{index}",
                index == 0 ? "published" : "approved",
                index == 0 ? "changes" : "decisions",
                new DateTime(2026, 8, 1, 11, 30, 0, DateTimeKind.Utc).AddDays(-index),
                index == 0 ? "Article values published to CPQ" : "Annual update approved",
                "The governed record passed the retained publication workflow.",
                index == 0 ? "Published by" : "Approved by",
                index == 0 ? "Publication Owner" : "Business Approver",
                jobId,
                "Articles_PDU_2027.xlsx",
                "upload",
                null,
                "Annual 2027 release",
                "Approved impact: 1 new, 2 modified and 0 scoped removals.",
                [new BusinessTraceChange("Article Master", "Name", $"Old value {index}", $"Current value {index}")]))
                .ToList());

        var pdf = new BusinessTracePdfDocumentBuilder().Build(trace, "Report User");

        var samplePath = Environment.GetEnvironmentVariable("CPQ_REPORT_SAMPLE_PATH");
        if (!string.IsNullOrWhiteSpace(samplePath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(samplePath)!);
            File.WriteAllBytes(samplePath, pdf);
        }

        Assert.True(pdf.Length > 10_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
