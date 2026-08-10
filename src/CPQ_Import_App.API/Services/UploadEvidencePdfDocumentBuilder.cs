using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CPQ_Import_App.API.Services;

public sealed class UploadEvidencePdfDocumentBuilder
{
    private const string Navy = "#10233F";
    private const string NavySoft = "#EAF0F7";
    private const string Teal = "#087F78";
    private const string TealSoft = "#E7F7F4";
    private const string Blue = "#3158C8";
    private const string BlueSoft = "#EEF3FF";
    private const string Green = "#16835B";
    private const string GreenSoft = "#EAF8F1";
    private const string Red = "#B42318";
    private const string RedSoft = "#FFF0EE";
    private const string Amber = "#9A6700";
    private const string AmberSoft = "#FFF7DF";
    private const string Text = "#172033";
    private const string Muted = "#5C6B82";
    private const string Border = "#D7E0EA";
    private const string Surface = "#F7F9FC";
    private const string White = "#FFFFFF";

    public byte[] Build(
        ImportJob job,
        ApprovedComparisonSnapshot? approval,
        ReleasePackageSummary? release,
        string generatedBy)
    {
        var generatedAt = DateTime.UtcNow;
        var fingerprint = CreateFingerprint(job, approval, release);
        var reportReference = $"PDU-PUB-{generatedAt:yyyyMMdd}-{fingerprint[..10]}";

        return Document.Create(document =>
        {
            document.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginHorizontal(34);
                page.MarginVertical(28);
                page.PageColor(White);
                page.DefaultTextStyle(style => style.FontFamily("Aptos").FontSize(9).FontColor(Text));

                page.Header().Element(container => ComposePageHeader(container, reportReference));
                page.Content().PaddingTop(18).Element(container => ComposeContent(
                    container, job, approval, release, generatedBy, generatedAt, fingerprint, reportReference));
                page.Footer().PaddingTop(10).Element(container => ComposeFooter(container, reportReference));
            });
        }).GeneratePdf();
    }

    private static void ComposePageHeader(IContainer container, string reportReference)
    {
        container.Row(row =>
        {
            row.RelativeItem().AlignMiddle().Text(text =>
            {
                text.Span("PDU").FontSize(13).Bold().FontColor(Navy);
                text.Span("  |  CONTROLLED PUBLICATION EVIDENCE").FontSize(8).SemiBold().FontColor(Teal);
            });
            row.RelativeItem().AlignRight().AlignMiddle().Text(reportReference).FontSize(7.5f).FontColor(Muted);
        });
    }

    private static void ComposeFooter(IContainer container, string reportReference)
    {
        container.BorderTop(1).BorderColor(Border).PaddingTop(7).Row(row =>
        {
            row.RelativeItem().Text($"Controlled evidence copy  |  {reportReference}").FontSize(7).FontColor(Muted);
            row.ConstantItem(110).AlignRight().Text(text =>
            {
                text.Span("Page ").FontSize(7).FontColor(Muted);
                text.CurrentPageNumber().FontSize(7).SemiBold().FontColor(Navy);
                text.Span(" of ").FontSize(7).FontColor(Muted);
                text.TotalPages().FontSize(7).SemiBold().FontColor(Navy);
            });
        });
    }

    private static void ComposeContent(
        IContainer container,
        ImportJob job,
        ApprovedComparisonSnapshot? approval,
        ReleasePackageSummary? release,
        string generatedBy,
        DateTime generatedAt,
        string fingerprint,
        string reportReference)
    {
        container.Column(column =>
        {
            column.Spacing(16);
            column.Item().Element(item => ComposeTitle(item, job, release, reportReference));
            column.Item().Element(item => ComposePublicationIdentity(item, job, release, generatedBy, generatedAt));
            column.Item().Element(item => ComposeResponsibility(item, job, approval, release));
            column.Item().Element(item => ComposeApprovedImpact(item, job, approval));
            if (release is not null)
                column.Item().Element(item => ComposeRelease(item, job, release));
            column.Item().Element(item => ComposeChangeRegister(item, approval, release is null ? "04" : "05"));
            column.Item().Element(item => ComposeIntegrityStatement(item, job, approval, release, fingerprint));
        });
    }

    private static void ComposeTitle(
        IContainer container,
        ImportJob job,
        ReleasePackageSummary? release,
        string reportReference)
    {
        container.Background(Navy).Padding(22).Column(column =>
        {
            column.Spacing(8);
            column.Item().Text("GOVERNED DATASET PUBLICATION").FontSize(8).Bold().LetterSpacing(.12f).FontColor("#7DE0D5");
            column.Item().Text("Upload Publication & Evidence Report").FontSize(23).Bold().FontColor(White);
            column.Item().Text($"{DatasetLabel(job.EntityType)}  /  {DisplayName(job.OriginalFileName)}")
                .FontSize(12).SemiBold().FontColor("#DDE8F7");
            column.Item().PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text(release is null
                        ? "Publication model: Individual publication"
                        : $"Publication model: Coordinated release - {release.Name}")
                    .FontSize(8.5f).FontColor("#B8C9DE");
                row.RelativeItem().AlignRight().Text(reportReference).FontSize(8.5f).SemiBold().FontColor("#B8C9DE");
            });
        });
    }

    private static void ComposePublicationIdentity(
        IContainer container,
        ImportJob job,
        ReleasePackageSummary? release,
        string generatedBy,
        DateTime generatedAt)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "01", "Publication identity", "The published dataset covered by this controlled evidence copy"));
            column.Item().PaddingTop(8).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn();
                    columns.RelativeColumn();
                    columns.RelativeColumn();
                });

                IdentityCell(table, "Published upload", DisplayName(job.OriginalFileName), true);
                IdentityCell(table, "Dataset", DatasetLabel(job.EntityType));
                IdentityCell(table, "Publication status", job.WorkflowStage == ImportWorkflowStage.Published ? "Published" : job.Status.ToString(), color: Green);
                IdentityCell(table, "Scope", "Saint-Marcellin - PDU");
                IdentityCell(table, "Publication model", release is null ? "Individual" : "Coordinated release");
                IdentityCell(table, "Release", release?.Name ?? "Not applicable");
                IdentityCell(table, "Upload ID", job.Id.ToString());
                IdentityCell(table, "Published", FormatDateTime(release?.PublishedAt ?? job.CommittedAt));
                IdentityCell(table, "Generated", $"{FormatDateTime(generatedAt)} by {Fallback(generatedBy, "Authenticated user")}");
            });
        });
    }

    private static void ComposeResponsibility(
        IContainer container,
        ImportJob job,
        ApprovedComparisonSnapshot? approval,
        ReleasePackageSummary? release)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "02", "Recorded responsibility", "Authenticated actors and timestamps retained by the publication workflow"));
            column.Item().PaddingTop(8).Row(row =>
            {
                ActorCard(row.RelativeItem(), "Uploaded by", job.CreatedByDisplayName, job.CreatedAt, Teal, TealSoft);
                row.Spacing(7);
                ActorCard(row.RelativeItem(), "Submitted by", release?.SubmittedByDisplayName ?? job.SubmittedByDisplayName,
                    release?.SubmittedAt ?? job.SubmittedAt, Amber, AmberSoft);
                row.Spacing(7);
                ActorCard(row.RelativeItem(), "Approved by", approval?.ApprovedByDisplayName ?? release?.ApprovedByDisplayName ?? job.ApprovedByDisplayName,
                    approval?.ApprovedAtUtc ?? release?.ApprovedAt ?? job.ApprovedAt, Blue, BlueSoft);
                row.Spacing(7);
                ActorCard(row.RelativeItem(), "Published by", release?.PublishedByDisplayName ?? job.CommittedBy,
                    release?.PublishedAt ?? job.CommittedAt, Green, GreenSoft);
            });

            column.Item().PaddingTop(8).Background(approval is null ? AmberSoft : GreenSoft)
                .Border(1).BorderColor(approval is null ? "#E8D69A" : "#B8E5D0").Padding(10).Text(text =>
                {
                    text.Span(approval is null ? "LEGACY EVIDENCE  " : "APPROVAL RECORD PRESERVED  ")
                        .FontSize(7.5f).Bold().FontColor(approval is null ? Amber : Green);
                    text.Span(approval is null
                            ? "No immutable approval snapshot is retained for this publication. Available workflow identities are shown above."
                            : "The exact comparison accepted by the approver is used throughout this report and is not recalculated against a newer baseline.")
                        .FontSize(8.5f).FontColor(Text);
                });
        });
    }

    private static void ComposeApprovedImpact(IContainer container, ImportJob job, ApprovedComparisonSnapshot? approval)
    {
        var comparison = approval?.Comparison;
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "03", "Approved publication impact", "The condition accepted at approval and the published row quality"));
            column.Item().PaddingTop(8).Row(row =>
            {
                MetricCard(row.RelativeItem(), "New", comparison?.NewRows, Green, GreenSoft);
                row.Spacing(7);
                MetricCard(row.RelativeItem(), "Modified", comparison?.ModifiedRows, Blue, BlueSoft);
                row.Spacing(7);
                MetricCard(row.RelativeItem(), "Unchanged", comparison?.UnchangedRows, Teal, TealSoft);
                row.Spacing(7);
                MetricCard(row.RelativeItem(), "Scoped removals", comparison?.MissingBaselineRows, Red, RedSoft);
            });

            column.Item().PaddingTop(8).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn();
                    columns.RelativeColumn();
                    columns.RelativeColumn();
                    columns.RelativeColumn();
                });
                IdentityCell(table, "Uploaded rows", job.TotalRows.ToString(CultureInfo.InvariantCulture));
                IdentityCell(table, "Valid at publication", job.ValidRows.ToString(CultureInfo.InvariantCulture), color: Green);
                IdentityCell(table, "Warnings", job.WarningRows.ToString(CultureInfo.InvariantCulture), color: job.WarningRows > 0 ? Amber : Text);
                IdentityCell(table, "Errors", job.ErrorRows.ToString(CultureInfo.InvariantCulture), color: job.ErrorRows > 0 ? Red : Green);
            });

            if (comparison is not null)
            {
                column.Item().PaddingTop(8).Background(Surface).Border(1).BorderColor(Border).Padding(9).Text(text =>
                {
                    text.Span("Comparison anchor  ").FontSize(7).Bold().FontColor(Muted);
                    text.Span(comparison.HasBaseline ? comparison.BaselineJobId.ToString() : "Initial governed publication - no prior baseline")
                        .FontSize(8).SemiBold().FontColor(Navy);
                    text.Span($"    |    {comparison.ComparedRows} row(s) compared").FontSize(8).FontColor(Muted);
                });
            }
        });
    }

    private static void ComposeRelease(IContainer container, ImportJob selectedJob, ReleasePackageSummary release)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "04", "Coordinated release evidence", "Datasets reviewed, approved and published as one governed decision"));
            column.Item().PaddingTop(8).Background(TealSoft).Border(1).BorderColor("#B8E5DF").Padding(11).Row(row =>
            {
                row.RelativeItem().Text(text =>
                {
                    text.Span("Release  ").FontSize(7).Bold().FontColor(Teal);
                    text.Span(release.Name).FontSize(10).SemiBold().FontColor(Navy);
                });
                row.RelativeItem().AlignRight().Text($"Reference: {release.Id}").FontSize(7).FontColor(Muted);
            });
            column.Item().PaddingTop(8).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(32);
                    columns.RelativeColumn(1.1f);
                    columns.RelativeColumn(1.8f);
                    columns.RelativeColumn(.7f);
                    columns.RelativeColumn(.8f);
                    columns.RelativeColumn(1.05f);
                });
                table.Header(header =>
                {
                    HeaderCell(header, "#");
                    HeaderCell(header, "Dataset");
                    HeaderCell(header, "Upload");
                    HeaderCell(header, "Rows");
                    HeaderCell(header, "Errors");
                    HeaderCell(header, "Role");
                });
                for (var index = 0; index < release.Items.Count; index++)
                {
                    var member = release.Items[index];
                    BodyCell(table, (index + 1).ToString(CultureInfo.InvariantCulture), index);
                    BodyCell(table, member.DatasetName, index, semiBold: true);
                    BodyCell(table, DisplayName(member.FileName), index, semiBold: member.JobId == selectedJob.Id);
                    BodyCell(table, member.TotalRows.ToString(CultureInfo.InvariantCulture), index);
                    BodyCell(table, member.ErrorRows.ToString(CultureInfo.InvariantCulture), index, color: member.ErrorRows > 0 ? Red : Green);
                    BodyCell(table, member.JobId == selectedJob.Id ? "Report subject" : member.IsValidationAnchor ? "Validation anchor" : "Companion dataset", index,
                        semiBold: member.JobId == selectedJob.Id, color: member.JobId == selectedJob.Id ? Blue : Text);
                }
            });
        });
    }

    private static void ComposeChangeRegister(IContainer container, ApprovedComparisonSnapshot? approval, string sectionNumber)
    {
        var comparison = approval?.Comparison;
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, sectionNumber, "Accepted change register", "Detailed values covered by the approver's recorded decision"));

            if (comparison is null)
            {
                column.Item().PaddingTop(8).Element(EmptyCell).Text("Detailed accepted changes are unavailable for this legacy publication.");
                return;
            }

            var changedRows = comparison.Rows
                .Where(row => row.ComparisonStatus is "New" or "Modified")
                .ToList();
            var detailCount = changedRows.Sum(row => Math.Max(1, row.Changes.Count(change => change.IsDifferent)));
            column.Item().PaddingTop(8).Text($"ADDED AND MODIFIED VALUES  |  {changedRows.Count} row(s), {detailCount} recorded field change(s)")
                .FontSize(7).Bold().LetterSpacing(.06f).FontColor(Blue);

            if (changedRows.Count == 0)
            {
                column.Item().PaddingTop(6).Element(EmptyCell).Text("No added or modified values were accepted in this publication.");
            }
            else
            {
                column.Item().PaddingTop(6).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(34);
                        columns.RelativeColumn(1.2f);
                        columns.RelativeColumn(.72f);
                        columns.RelativeColumn(1.0f);
                        columns.RelativeColumn(1.25f);
                        columns.RelativeColumn(1.25f);
                    });
                    table.Header(header =>
                    {
                        HeaderCell(header, "Row");
                        HeaderCell(header, "Business key");
                        HeaderCell(header, "Change");
                        HeaderCell(header, "Field");
                        HeaderCell(header, "Before");
                        HeaderCell(header, "Approved value");
                    });

                    var detailIndex = 0;
                    foreach (var row in changedRows)
                    {
                        var changes = row.Changes.Where(change => change.IsDifferent).ToList();
                        if (changes.Count == 0)
                        {
                            BodyCell(table, row.RowNumber.ToString(CultureInfo.InvariantCulture), detailIndex);
                            BodyCell(table, row.Key, detailIndex, semiBold: true);
                            BodyCell(table, row.ComparisonStatus, detailIndex, color: row.ComparisonStatus == "New" ? Green : Blue);
                            BodyCell(table, "Record", detailIndex);
                            BodyCell(table, "Not in baseline", detailIndex, color: Red);
                            BodyCell(table, "Accepted", detailIndex, semiBold: true, color: Green);
                            detailIndex++;
                            continue;
                        }

                        foreach (var change in changes)
                        {
                            BodyCell(table, row.RowNumber.ToString(CultureInfo.InvariantCulture), detailIndex);
                            BodyCell(table, row.Key, detailIndex, semiBold: true);
                            BodyCell(table, row.ComparisonStatus, detailIndex, color: row.ComparisonStatus == "New" ? Green : Blue);
                            BodyCell(table, change.Field, detailIndex);
                            BodyCell(table, Fallback(change.BaselineValue, "Not in baseline"), detailIndex, color: Red);
                            BodyCell(table, Fallback(change.CurrentValue, "Empty"), detailIndex, semiBold: true, color: Green);
                            detailIndex++;
                        }
                    }
                });
            }

            column.Item().PaddingTop(14).Text($"SCOPED REMOVALS  |  {comparison.MissingRows.Count} row(s)")
                .FontSize(7).Bold().LetterSpacing(.06f).FontColor(Red);
            if (comparison.MissingRows.Count == 0)
            {
                column.Item().PaddingTop(6).Element(EmptyCell).Text("No baseline rows were approved for removal.");
            }
            else
            {
                column.Item().PaddingTop(6).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(1.15f);
                        columns.RelativeColumn(3.85f);
                    });
                    table.Header(header =>
                    {
                        HeaderCell(header, "Business key");
                        HeaderCell(header, "Removed baseline values");
                    });
                    for (var index = 0; index < comparison.MissingRows.Count; index++)
                    {
                        var missing = comparison.MissingRows[index];
                        var values = string.Join("  |  ", missing.BaselineValues
                            .Where(pair => !string.IsNullOrWhiteSpace(pair.Value))
                            .Select(pair => $"{pair.Key}: {pair.Value}"));
                        BodyCell(table, missing.Key, index, semiBold: true, color: Red);
                        BodyCell(table, Fallback(values, "Baseline record removed"), index);
                    }
                });
            }
        });
    }

    private static void ComposeIntegrityStatement(
        IContainer container,
        ImportJob job,
        ApprovedComparisonSnapshot? approval,
        ReleasePackageSummary? release,
        string fingerprint)
    {
        container.Background(NavySoft).Border(1).BorderColor(Border).Padding(14).Column(column =>
        {
            column.Spacing(6);
            column.Item().Text("EVIDENCE AND INTEGRITY NOTE").FontSize(8).Bold().LetterSpacing(.08f).FontColor(Navy);
            column.Item().Text(
                    "This system-generated report renders the publication, approval and release evidence retained by the CPQ Dataset Platform for the upload shown above. " +
                    "Names and timestamps are authenticated identities and workflow events recorded by the application. " +
                    "This document is an evidence copy; it is not, by itself, a qualified electronic signature or external certification.")
                .FontSize(8).LineHeight(1.35f).FontColor(Text);
            column.Item().PaddingTop(3).Text(text =>
            {
                text.Span("Evidence fingerprint: ").FontSize(7).SemiBold().FontColor(Muted);
                text.Span(fingerprint).FontFamily("Consolas").FontSize(6.7f).FontColor(Navy);
            });
            column.Item().Text($"Coverage: upload {job.Id}; {approval?.Comparison.Rows.Count ?? 0} compared row record(s); {release?.Items.Count ?? 1} publication member(s).")
                .FontSize(7).FontColor(Muted);
        });
    }

    private static void SectionHeading(IContainer container, string number, string title, string subtitle)
    {
        container.Row(row =>
        {
            row.ConstantItem(30).Height(30).AlignCenter().AlignMiddle().Background(Teal).Text(number).FontSize(9).Bold().FontColor(White);
            row.RelativeItem().PaddingLeft(10).Column(column =>
            {
                column.Item().Text(title).FontSize(13).Bold().FontColor(Navy);
                column.Item().Text(subtitle).FontSize(7.5f).FontColor(Muted);
            });
        });
    }

    private static void IdentityCell(TableDescriptor table, string label, string value, bool emphasize = false, string color = Text)
    {
        table.Cell().Border(1).BorderColor(Border).Background(White).Padding(10).Column(column =>
        {
            column.Item().Text(label.ToUpperInvariant()).FontSize(6.5f).Bold().LetterSpacing(.05f).FontColor(Muted);
            column.Item().PaddingTop(4).Text(Fallback(value)).FontSize(emphasize ? 10.5f : 8.5f).SemiBold().FontColor(color);
        });
    }

    private static void ActorCard(IContainer container, string label, string? actor, DateTime? occurredAt, string accent, string fill)
    {
        container.MinHeight(82).Border(1).BorderColor(Border).Background(fill).Padding(9).Column(column =>
        {
            column.Item().Text(label.ToUpperInvariant()).FontSize(6.2f).Bold().LetterSpacing(.05f).FontColor(accent);
            column.Item().PaddingTop(5).Text(Fallback(actor, "Not recorded")).FontSize(8.5f).SemiBold().FontColor(Text);
            column.Item().Text(FormatDateTime(occurredAt)).FontSize(6.7f).FontColor(Muted);
        });
    }

    private static void MetricCard(IContainer container, string label, int? value, string accent, string fill)
    {
        container.MinHeight(66).Border(1).BorderColor(Border).Background(fill).Padding(10).Column(column =>
        {
            column.Item().Text(label.ToUpperInvariant()).FontSize(6.3f).Bold().LetterSpacing(.05f).FontColor(accent);
            column.Item().PaddingTop(5).Text(value?.ToString(CultureInfo.InvariantCulture) ?? "N/A").FontSize(17).Bold().FontColor(accent);
        });
    }

    private static void HeaderCell(TableCellDescriptor table, string value)
    {
        table.Cell().Element(HeaderCellContainer).Text(value.ToUpperInvariant()).FontSize(6.2f).Bold().LetterSpacing(.035f).FontColor(Navy);
    }

    private static void BodyCell(
        TableDescriptor table,
        string value,
        int rowIndex,
        bool semiBold = false,
        string color = Text,
        float fontSize = 7.2f)
    {
        var text = table.Cell().Element(container => BodyCellContainer(container, rowIndex)).Text(Fallback(value)).FontSize(fontSize).FontColor(color);
        if (semiBold) text.SemiBold();
    }

    private static IContainer HeaderCellContainer(IContainer container) =>
        container.BorderBottom(1).BorderColor(Border).Background(NavySoft).PaddingVertical(7).PaddingHorizontal(6);

    private static IContainer BodyCellContainer(IContainer container, int rowIndex) =>
        container.BorderBottom(1).BorderColor(Border).Background(rowIndex % 2 == 0 ? White : Surface).PaddingVertical(6).PaddingHorizontal(6);

    private static IContainer EmptyCell(IContainer container) =>
        container.Border(1).BorderColor(Border).Background(Surface).Padding(12).AlignCenter();

    private static string CreateFingerprint(
        ImportJob job,
        ApprovedComparisonSnapshot? approval,
        ReleasePackageSummary? release)
    {
        var canonical = JsonSerializer.Serialize(new
        {
            job.Id,
            job.OriginalFileName,
            job.EntityType,
            job.WorkflowStage,
            job.CreatedBy,
            job.CreatedByDisplayName,
            job.CreatedAt,
            job.SubmittedAt,
            job.SubmittedByUserId,
            job.SubmittedByDisplayName,
            job.ApprovedAt,
            job.ApprovedByUserId,
            job.ApprovedByDisplayName,
            job.CommittedAt,
            job.CommittedBy,
            job.TotalRows,
            job.ValidRows,
            job.WarningRows,
            job.ErrorRows,
            job.CommittedRows,
            job.ValidationAnchorJobId,
            job.ValidationAnchorKind,
            job.ValidationAnchorPinnedAt,
            Approval = approval,
            Release = release
        });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    private static string DatasetLabel(EntityType entityType) => entityType switch
    {
        EntityType.Article => "Article Master",
        EntityType.PriceList => "Basis Price",
        EntityType.Description => "Descriptions",
        EntityType.CurrencyRate => "Currency Rates",
        _ => entityType.ToString()
    };

    private static string DisplayName(string value) => Path.GetFileNameWithoutExtension(value);

    private static string FormatDateTime(DateTime? value) =>
        value.HasValue ? value.Value.ToUniversalTime().ToString("dd MMM yyyy HH:mm 'UTC'", CultureInfo.InvariantCulture) : "Not recorded";

    private static string Fallback(string? value, string fallback = "Not recorded") =>
        string.IsNullOrWhiteSpace(value) ? fallback : value;
}
