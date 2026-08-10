using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CPQ_Import_App.Core.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CPQ_Import_App.API.Services;

public sealed class BusinessTracePdfDocumentBuilder
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
    private const string Text = "#172033";
    private const string Muted = "#5C6B82";
    private const string Border = "#D7E0EA";
    private const string Surface = "#F7F9FC";
    private const string White = "#FFFFFF";

    public byte[] Build(BusinessTraceResult trace, string generatedBy)
    {
        var generatedAt = DateTime.UtcNow;
        var fingerprint = CreateFingerprint(trace);
        var reportReference = $"PDU-TRACE-{generatedAt:yyyyMMdd}-{fingerprint[..10]}";

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
                    container, trace, generatedBy, generatedAt, fingerprint, reportReference));
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
                text.Span("  |  GOVERNED DATA EVIDENCE").FontSize(8).SemiBold().FontColor(Teal);
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
        BusinessTraceResult trace,
        string generatedBy,
        DateTime generatedAt,
        string fingerprint,
        string reportReference)
    {
        container.Column(column =>
        {
            column.Spacing(16);
            column.Item().Element(item => ComposeTitle(item, trace, reportReference));
            column.Item().Element(item => ComposeIdentity(item, trace, generatedBy, generatedAt));
            column.Item().Element(item => ComposeCurrentRecord(item, trace));
            column.Item().Element(item => ComposeResponsibility(item, trace));
            column.Item().Element(item => ComposeSources(item, trace));
            column.Item().Element(item => ComposeTimeline(item, trace));
            column.Item().Element(item => ComposeIntegrityStatement(item, trace, fingerprint));
        });
    }

    private static void ComposeTitle(IContainer container, BusinessTraceResult trace, string reportReference)
    {
        container.Background(Navy).Padding(22).Column(column =>
        {
            column.Spacing(8);
            column.Item().Text("GOVERNED PUBLICATION RECORD").FontSize(8).Bold().LetterSpacing(.12f).FontColor("#7DE0D5");
            column.Item().Text("Data Trace & Evidence Report").FontSize(25).Bold().FontColor(White);
            column.Item().Text($"{trace.ObjectTypeLabel}  /  {trace.Identifier}").FontSize(12).SemiBold().FontColor("#DDE8F7");
            column.Item().PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text($"Scope: {trace.Scope.Site} - {trace.Scope.ProductFamily}").FontSize(8.5f).FontColor("#B8C9DE");
                row.RelativeItem().AlignRight().Text(reportReference).FontSize(8.5f).SemiBold().FontColor("#B8C9DE");
            });
        });
    }

    private static void ComposeIdentity(
        IContainer container,
        BusinessTraceResult trace,
        string generatedBy,
        DateTime generatedAt)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "01", "Record identity", "The governed object covered by this evidence copy"));
            column.Item().PaddingTop(8).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn();
                    columns.RelativeColumn();
                    columns.RelativeColumn();
                });

                IdentityCell(table, "Identifier", trace.Identifier, true);
                IdentityCell(table, "Object type", trace.ObjectTypeLabel);
                IdentityCell(table, "Current status", trace.StatusLabel, color: trace.IsActive ? Green : Red);
                IdentityCell(table, "Site", trace.Scope.Site);
                IdentityCell(table, "Product family", trace.Scope.ProductFamily);
                IdentityCell(table, "Business category", trace.Scope.Category);
                IdentityCell(table, "Introduced", FormatDateTime(trace.IntroducedAt));
                IdentityCell(table, "Last published", FormatDateTime(trace.LastPublishedAt));
                IdentityCell(table, "Generated", $"{FormatDateTime(generatedAt)} by {Fallback(generatedBy, "Authenticated user")}");
            });
        });
    }

    private static void ComposeCurrentRecord(IContainer container, BusinessTraceResult trace)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "02", "Current governed values", "Values represented as current in the selected PDU scope"));
            column.Item().PaddingTop(8).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(.85f);
                    columns.RelativeColumn(1.15f);
                    columns.RelativeColumn(2.1f);
                    columns.RelativeColumn(1.2f);
                });

                table.Header(header =>
                {
                    HeaderCell(header, "Domain");
                    HeaderCell(header, "Field");
                    HeaderCell(header, "Current value");
                    HeaderCell(header, "Context");
                });

                if (trace.CurrentFields.Count == 0)
                {
                    table.Cell().ColumnSpan(4).Element(EmptyCell).Text("No current values. This object is retained in publication history only.");
                }
                else
                {
                    for (var index = 0; index < trace.CurrentFields.Count; index++)
                    {
                        var field = trace.CurrentFields[index];
                        BodyCell(table, field.Domain, index);
                        BodyCell(table, field.Label, index, semiBold: true);
                        BodyCell(table, Fallback(field.Value), index, semiBold: true, color: field.Kind == "price" ? Green : Text);
                        BodyCell(table, Fallback(field.Hint, trace.Scope.Currency), index);
                    }
                }
            });
        });
    }

    private static void ComposeResponsibility(IContainer container, BusinessTraceResult trace)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "03", "Recorded responsibility", "Accountable people and decision timestamps retained by the platform"));
            column.Item().PaddingTop(8).Row(row =>
            {
                ActorCard(row.RelativeItem(), "Prepared", trace.Responsibility.Prepared, Teal, TealSoft);
                row.Spacing(8);
                ActorCard(row.RelativeItem(), "Approved", trace.Responsibility.Approved, Blue, BlueSoft);
                row.Spacing(8);
                ActorCard(row.RelativeItem(), "Published", trace.Responsibility.Published, Green, GreenSoft);
            });
            column.Item().PaddingTop(8).Background(trace.Responsibility.ApprovalEvidencePreserved ? GreenSoft : RedSoft)
                .Border(1).BorderColor(trace.Responsibility.ApprovalEvidencePreserved ? "#B8E5D0" : "#F3C3BE")
                .Padding(10).Row(row =>
                {
                    row.ConstantItem(21).Text(trace.Responsibility.ApprovalEvidencePreserved ? "OK" : "!")
                        .FontSize(9).Bold().FontColor(trace.Responsibility.ApprovalEvidencePreserved ? Green : Red);
                    row.RelativeItem().Text(trace.Responsibility.ApprovalEvidencePreserved
                            ? "Approval evidence preserved. The accepted comparison is retained independently from later publications."
                            : "No preserved approval snapshot is associated with the latest source record.")
                        .FontSize(8.5f).FontColor(Text);
                });
        });
    }

    private static void ComposeSources(IContainer container, BusinessTraceResult trace)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "04", "Evidence sources", "Files and releases supporting the current governed state"));
            column.Item().PaddingTop(8).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(.85f);
                    columns.RelativeColumn(1.65f);
                    columns.RelativeColumn(1.1f);
                    columns.RelativeColumn(1.25f);
                    columns.RelativeColumn(1.25f);
                });
                table.Header(header =>
                {
                    HeaderCell(header, "Dataset");
                    HeaderCell(header, "Source file");
                    HeaderCell(header, "Published");
                    HeaderCell(header, "Release");
                    HeaderCell(header, "Evidence ID");
                });

                if (trace.Sources.Count == 0)
                {
                    table.Cell().ColumnSpan(5).Element(EmptyCell).Text("No active source file is associated with this historical record.");
                }
                else
                {
                    for (var index = 0; index < trace.Sources.Count; index++)
                    {
                        var source = trace.Sources[index];
                        BodyCell(table, source.Dataset, index, semiBold: true);
                        BodyCell(table, source.FileName, index);
                        BodyCell(table, FormatDateTime(source.PublishedAt), index);
                        BodyCell(table, Fallback(source.ReleaseName, "Individual publication"), index);
                        BodyCell(table, source.JobId.ToString(), index, color: Muted, fontSize: 6.5f);
                    }
                }
            });
        });
    }

    private static void ComposeTimeline(IContainer container, BusinessTraceResult trace)
    {
        container.Column(column =>
        {
            column.Item().Element(item => SectionHeading(item, "05", "Decision and publication history", $"{trace.Events.Count} retained event(s), newest first"));

            if (trace.Events.Count == 0)
            {
                column.Item().PaddingTop(8).Element(EmptyCell).Text("No retained timeline events were found.");
                return;
            }

            foreach (var entry in trace.Events)
            {
                column.Item().PaddingTop(8).EnsureSpace(150).Border(1).BorderColor(Border).Background(White).Padding(12).Column(card =>
                {
                    card.Spacing(7);
                    card.Item().Row(row =>
                    {
                        row.ConstantItem(102).Text(FormatDateTime(entry.OccurredAt)).FontSize(8).SemiBold().FontColor(Teal);
                        row.RelativeItem().Column(title =>
                        {
                            title.Item().Text(entry.Title).FontSize(11).SemiBold().FontColor(Navy);
                            title.Item().Text(entry.Summary).FontSize(8.5f).FontColor(Muted);
                        });
                        row.ConstantItem(78).AlignRight().Element(item => EventBadge(item, entry.Kind));
                    });

                    card.Item().Background(Surface).Padding(8).Row(row =>
                    {
                        row.RelativeItem().Text(text =>
                        {
                            text.Span($"{entry.ActorLabel}: ").FontSize(7).FontColor(Muted);
                            text.Span(Fallback(entry.Actor)).FontSize(8).SemiBold().FontColor(Text);
                        });
                        row.RelativeItem().Text(text =>
                        {
                            text.Span("Source: ").FontSize(7).FontColor(Muted);
                            text.Span(Fallback(entry.SourceName)).FontSize(8).SemiBold().FontColor(Text);
                        });
                        row.RelativeItem().Text(text =>
                        {
                            text.Span("Release: ").FontSize(7).FontColor(Muted);
                            text.Span(Fallback(entry.ReleaseName, "Individual publication")).FontSize(8).SemiBold().FontColor(Text);
                        });
                    });

                    if (!string.IsNullOrWhiteSpace(entry.Decision))
                    {
                        card.Item().BorderLeft(3).BorderColor(Blue).Background(BlueSoft).Padding(9).Text(text =>
                        {
                            text.Span("Recorded decision  ").FontSize(7.5f).Bold().FontColor(Blue);
                            text.Span(entry.Decision).FontSize(8.5f).FontColor(Text);
                        });
                    }

                    if (entry.Changes.Count > 0)
                    {
                        card.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(.8f);
                                columns.RelativeColumn(1.1f);
                                columns.RelativeColumn(1.55f);
                                columns.RelativeColumn(1.55f);
                            });
                            table.Header(header =>
                            {
                                HeaderCell(header, "Domain");
                                HeaderCell(header, "Field");
                                HeaderCell(header, "Before");
                                HeaderCell(header, "After");
                            });
                            for (var index = 0; index < entry.Changes.Count; index++)
                            {
                                var change = entry.Changes[index];
                                BodyCell(table, change.Domain, index);
                                BodyCell(table, change.Field, index, semiBold: true);
                                BodyCell(table, Fallback(change.Before, "Not in CPQ"), index, color: Red);
                                BodyCell(table, Fallback(change.After, "Removed"), index, semiBold: true, color: Green);
                            }
                        });
                    }
                });
            }
        });
    }

    private static void ComposeIntegrityStatement(IContainer container, BusinessTraceResult trace, string fingerprint)
    {
        container.Background(NavySoft).Border(1).BorderColor(Border).Padding(14).Column(column =>
        {
            column.Spacing(6);
            column.Item().Text("EVIDENCE AND INTEGRITY NOTE").FontSize(8).Bold().LetterSpacing(.08f).FontColor(Navy);
            column.Item().Text(
                    "This system-generated report renders governed records retained by the CPQ Dataset Platform for the scope shown above. " +
                    "Names and timestamps are the authenticated identities and workflow events recorded by the application. " +
                    "This document is an evidence copy; it is not, by itself, a qualified electronic signature or external certification.")
                .FontSize(8).LineHeight(1.35f).FontColor(Text);
            column.Item().PaddingTop(3).Text(text =>
            {
                text.Span("Evidence fingerprint: ").FontSize(7).SemiBold().FontColor(Muted);
                text.Span(fingerprint).FontFamily("Consolas").FontSize(6.7f).FontColor(Navy);
            });
            column.Item().Text($"Record coverage: {trace.Events.Count} event(s), {trace.Sources.Count} source(s), {trace.CurrentFields.Count} current field(s).")
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
            column.Item().PaddingTop(4).Text(Fallback(value)).FontSize(emphasize ? 11 : 9).SemiBold().FontColor(color);
        });
    }

    private static void ActorCard(IContainer container, string label, BusinessTraceActor? actor, string accent, string fill)
    {
        container.MinHeight(76).Border(1).BorderColor(Border).Background(fill).Padding(10).Column(column =>
        {
            column.Item().Text(label.ToUpperInvariant()).FontSize(6.5f).Bold().LetterSpacing(.06f).FontColor(accent);
            column.Item().PaddingTop(5).Text(Fallback(actor?.DisplayName, "Not recorded")).FontSize(9).SemiBold().FontColor(Text);
            column.Item().Text(FormatDateTime(actor?.OccurredAt)).FontSize(7).FontColor(Muted);
        });
    }

    private static void EventBadge(IContainer container, string kind)
    {
        var (label, color, fill) = kind.ToLowerInvariant() switch
        {
            "published" => ("PUBLISHED", Green, GreenSoft),
            "approved" => ("APPROVED", Blue, BlueSoft),
            "submitted" => ("SUBMITTED", Amber, "#FFF7DF"),
            "introduced" => ("INTRODUCED", Teal, TealSoft),
            "removed" => ("REMOVED", Red, RedSoft),
            _ => (kind.ToUpperInvariant(), Muted, Surface)
        };
        container.Background(fill).Border(1).BorderColor(color).PaddingVertical(5).PaddingHorizontal(7)
            .AlignCenter().Text(label).FontSize(6.5f).Bold().FontColor(color);
    }

    private static void HeaderCell(TableCellDescriptor table, string value)
    {
        table.Cell().Element(HeaderCellContainer).Text(value.ToUpperInvariant()).FontSize(6.5f).Bold().LetterSpacing(.04f).FontColor(Navy);
    }

    private static void BodyCell(
        TableDescriptor table,
        string value,
        int rowIndex,
        bool semiBold = false,
        string color = Text,
        float fontSize = 7.5f)
    {
        var text = table.Cell().Element(container => BodyCellContainer(container, rowIndex)).Text(Fallback(value)).FontSize(fontSize).FontColor(color);
        if (semiBold) text.SemiBold();
    }

    private static IContainer HeaderCellContainer(IContainer container) =>
        container.BorderBottom(1).BorderColor(Border).Background(NavySoft).PaddingVertical(7).PaddingHorizontal(7);

    private static IContainer BodyCellContainer(IContainer container, int rowIndex) =>
        container.BorderBottom(1).BorderColor(Border).Background(rowIndex % 2 == 0 ? White : Surface).PaddingVertical(7).PaddingHorizontal(7);

    private static IContainer EmptyCell(IContainer container) =>
        container.Border(1).BorderColor(Border).Background(Surface).Padding(12).AlignCenter();

    private static string CreateFingerprint(BusinessTraceResult trace)
    {
        var canonical = JsonSerializer.Serialize(new
        {
            trace.Scope.Key,
            trace.ObjectType,
            trace.Identifier,
            trace.IsActive,
            trace.LastPublishedAt,
            trace.IntroducedAt,
            trace.CurrentFields,
            trace.Sources,
            trace.Responsibility,
            trace.Events
        });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    private static string FormatDateTime(DateTime? value) =>
        value.HasValue ? value.Value.ToUniversalTime().ToString("dd MMM yyyy HH:mm 'UTC'", CultureInfo.InvariantCulture) : "Not recorded";

    private static string Fallback(string? value, string fallback = "Not recorded") =>
        string.IsNullOrWhiteSpace(value) ? fallback : value;
}
