using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CPQ_Import_App.API.Services;

public sealed class EvolisPdfDocumentBuilder
{
    private const string Navy = "#10233F";
    private const string NavySoft = "#EAF0F7";
    private const string Teal = "#087F78";
    private const string TealSoft = "#E7F7F4";
    private const string Blue = "#3158C8";
    private const string BlueSoft = "#EEF3FF";
    private const string Green = "#16835B";
    private const string GreenSoft = "#EAF8F1";
    private const string Amber = "#9A6700";
    private const string AmberSoft = "#FFF7E2";
    private const string Text = "#172033";
    private const string Muted = "#5C6B82";
    private const string Border = "#D7E0EA";
    private const string Surface = "#F7F9FC";
    private const string White = "#FFFFFF";

    public byte[] Build(string decryptedContent, string sourceFileName)
    {
        var report = EvolisReport.Parse(decryptedContent, sourceFileName);
        var fingerprint = CreateFingerprint(decryptedContent, sourceFileName);
        var reportReference = $"PDU-EVOLIS-{DateTime.UtcNow:yyyyMMdd}-{fingerprint[..10]}";

        return Document.Create(document =>
        {
            document.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.MarginHorizontal(30);
                page.MarginVertical(25);
                page.PageColor(White);
                page.DefaultTextStyle(style => style.FontFamily("Aptos").FontSize(8.5f).FontColor(Text));

                page.Header().Element(header => ComposePageHeader(header, reportReference));
                page.Content().PaddingTop(16).Element(content => ComposeContent(content, report, fingerprint, reportReference));
                page.Footer().PaddingTop(9).Element(footer => ComposeFooter(footer, reportReference));
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
                text.Span("  |  INTERNAL CONFIGURATION OUTPUT").FontSize(8).SemiBold().FontColor(Teal);
            });
            row.RelativeItem().AlignRight().AlignMiddle().Text(reportReference).FontSize(7.5f).FontColor(Muted);
        });
    }

    private static void ComposeFooter(IContainer container, string reportReference)
    {
        container.BorderTop(1).BorderColor(Border).PaddingTop(7).Row(row =>
        {
            row.RelativeItem().Text($"Controlled Evolis output  |  {reportReference}").FontSize(7).FontColor(Muted);
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
        EvolisReport report,
        string fingerprint,
        string reportReference)
    {
        container.Column(column =>
        {
            column.Spacing(12);
            column.Item().Element(item => ComposeTitle(item, report, reportReference));
            column.Item().Element(item => ComposeOverview(item, report));

            for (var index = 0; index < report.Tables.Count; index++)
            {
                var sectionNumber = (index + 1).ToString("00", CultureInfo.InvariantCulture);
                column.Item().Element(item => ComposeConfiguration(item, report.Tables[index], sectionNumber));
            }

            column.Item().Element(item => ComposeIntegrityStatement(item, report, fingerprint));
        });
    }

    private static void ComposeTitle(IContainer container, EvolisReport report, string reportReference)
    {
        container.Background(Navy).Padding(16).Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Spacing(6);
                column.Item().Text("CONTROLLED DECRYPTION OUTPUT").FontSize(8).Bold().LetterSpacing(.12f).FontColor("#7DE0D5");
                column.Item().Text("Evolis Configuration Report").FontSize(22).Bold().FontColor(White);
                column.Item().Text(Path.GetFileNameWithoutExtension(report.SourceFileName)).FontSize(11).SemiBold().FontColor("#DDE8F7");
            });
            row.ConstantItem(245).AlignMiddle().Column(column =>
            {
                column.Item().Text("REPORT REFERENCE").FontSize(6.5f).Bold().LetterSpacing(.08f).FontColor("#91A9C5");
                column.Item().PaddingTop(3).Text(reportReference).FontSize(9).SemiBold().FontColor(White);
                column.Item().PaddingTop(9).Text("GENERATED").FontSize(6.5f).Bold().LetterSpacing(.08f).FontColor("#91A9C5");
                column.Item().PaddingTop(3).Text(report.GeneratedAt).FontSize(8).FontColor("#DDE8F7");
            });
        });
    }

    private static void ComposeOverview(IContainer container, EvolisReport report)
    {
        var standardRows = report.Tables.Sum(table => table.LineRows.Count);
        var configuredRows = report.Tables.Sum(table => table.ConfiguredRows.Count);
        container.Column(column =>
        {
            column.Item().Row(row =>
            {
                MetricCard(row.RelativeItem(), "Configurations", report.Tables.Count.ToString(CultureInfo.InvariantCulture), Teal, TealSoft);
                row.Spacing(8);
                MetricCard(row.RelativeItem(), "Standard rows", standardRows.ToString(CultureInfo.InvariantCulture), Blue, BlueSoft);
                row.Spacing(8);
                MetricCard(row.RelativeItem(), "Configured rows", configuredRows.ToString(CultureInfo.InvariantCulture), Green, GreenSoft);
                row.Spacing(8);
                MetricCard(row.RelativeItem(), "Grand total", report.GrandTotal, Amber, AmberSoft);
            });
            column.Item().PaddingTop(7).Border(1).BorderColor(Border).Background(Surface).Padding(8).Row(row =>
            {
                row.RelativeItem().Text(text =>
                {
                    text.Span("SOURCE FILE  ").FontSize(6.5f).Bold().LetterSpacing(.05f).FontColor(Muted);
                    text.Span(report.SourceFileName).FontSize(8.5f).SemiBold().FontColor(Navy);
                });
                row.RelativeItem().AlignRight().Text("Prices shown are decrypted configuration values; totals equal quantity x unit price.")
                    .FontSize(7.5f).FontColor(Muted);
            });
        });
    }

    private static void ComposeConfiguration(IContainer container, EvolisTableSection source, string sectionNumber)
    {
        container.Column(section =>
        {
            section.Item().Element(item => SectionHeading(item, sectionNumber, source.Title, "Basket configuration and decrypted pricing detail"));
            section.Item().PaddingTop(8).Row(row =>
            {
                MetadataCell(row.RelativeItem(), "Basket", source.IdPanier, Teal);
                row.Spacing(8);
                MetadataCell(row.RelativeItem(), "Effective date", FormatDate(source.Date), Blue);
                row.Spacing(8);
                MetadataCell(row.RelativeItem(), "Rows", (source.LineRows.Count + source.ConfiguredRows.Count).ToString(CultureInfo.InvariantCulture), Green);
                row.Spacing(8);
                MetadataCell(row.RelativeItem(), "Subtotal", source.Subtotal, Amber);
            });

            if (source.LineRows.Count > 0)
            {
                section.Item().PaddingTop(10).Text($"STANDARD COMPONENTS  |  {source.LineRows.Count} row(s)")
                    .FontSize(7).Bold().LetterSpacing(.06f).FontColor(Blue);
                section.Item().PaddingTop(5).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(38);
                        columns.RelativeColumn(.75f);
                        columns.RelativeColumn(3.25f);
                    });
                    table.Header(header =>
                    {
                        HeaderCell(header, "Type");
                        HeaderCell(header, "Quantity");
                        HeaderCell(header, "Generic part number");
                    });
                    for (var index = 0; index < source.LineRows.Count; index++)
                    {
                        var line = source.LineRows[index];
                        BodyCell(table, "L", index, semiBold: true, color: Blue, centered: true);
                        BodyCell(table, line.Quantity, index);
                        BodyCell(table, line.GenericPartNumber, index, semiBold: true);
                    }
                });
            }

            if (source.ConfiguredRows.Count > 0)
            {
                section.Item().PaddingTop(10).Text($"CONFIGURED COMPONENTS  |  {source.ConfiguredRows.Count} row(s)")
                    .FontSize(7).Bold().LetterSpacing(.06f).FontColor(Teal);
                section.Item().PaddingTop(5).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(38);
                        columns.RelativeColumn(1.35f);
                        columns.RelativeColumn(.55f);
                        columns.RelativeColumn(2.8f);
                        columns.RelativeColumn(.9f);
                        columns.RelativeColumn(.95f);
                    });
                    table.Header(header =>
                    {
                        HeaderCell(header, "Type");
                        HeaderCell(header, "Generic part number");
                        HeaderCell(header, "Qty");
                        HeaderCell(header, "Description");
                        HeaderCell(header, "Unit price", true);
                        HeaderCell(header, "Total price", true);
                    });
                    for (var index = 0; index < source.ConfiguredRows.Count; index++)
                    {
                        var configured = source.ConfiguredRows[index];
                        BodyCell(table, "C", index, semiBold: true, color: Teal, centered: true);
                        BodyCell(table, configured.GenericPartNumber, index, semiBold: true);
                        BodyCell(table, configured.Quantity, index);
                        BodyCell(table, configured.Description, index);
                        BodyCell(table, configured.UnitPrice, index, rightAligned: true);
                        BodyCell(table, configured.TotalPrice, index, semiBold: true, color: Green, rightAligned: true);
                    }
                });
            }
        });
    }

    private static void ComposeIntegrityStatement(IContainer container, EvolisReport report, string fingerprint)
    {
        container.Background(NavySoft).Border(1).BorderColor(Border).Padding(13).Column(column =>
        {
            column.Spacing(5);
            column.Item().Text("OUTPUT AND INTEGRITY NOTE").FontSize(8).Bold().LetterSpacing(.08f).FontColor(Navy);
            column.Item().Text(
                    "This system-generated report presents the decrypted Evolis configuration content supplied to the CPQ Platform. " +
                    "Values are rendered from the retained result; configured totals are calculated as quantity multiplied by unit price. " +
                    "The report supports operational review and does not alter the source configuration.")
                .FontSize(8).LineHeight(1.35f).FontColor(Text);
            column.Item().PaddingTop(3).Text(text =>
            {
                text.Span("Output fingerprint: ").FontSize(7).SemiBold().FontColor(Muted);
                text.Span(fingerprint).FontFamily("Consolas").FontSize(6.7f).FontColor(Navy);
            });
            column.Item().Text($"Coverage: {report.Tables.Count} configuration(s); source {report.SourceFileName}.").FontSize(7).FontColor(Muted);
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

    private static void MetricCard(IContainer container, string label, string value, string accent, string fill)
    {
        container.MinHeight(54).Border(1).BorderColor(Border).Background(fill).Padding(8).Column(column =>
        {
            column.Item().Text(label.ToUpperInvariant()).FontSize(6.4f).Bold().LetterSpacing(.05f).FontColor(accent);
            column.Item().PaddingTop(5).Text(value).FontSize(16).Bold().FontColor(accent);
        });
    }

    private static void MetadataCell(IContainer container, string label, string value, string accent)
    {
        container.Border(1).BorderColor(Border).Background(White).Padding(7).Column(column =>
        {
            column.Item().Text(label.ToUpperInvariant()).FontSize(6.2f).Bold().LetterSpacing(.05f).FontColor(accent);
            column.Item().PaddingTop(3).Text(string.IsNullOrWhiteSpace(value) ? "Not recorded" : value).FontSize(8.5f).SemiBold().FontColor(Text);
        });
    }

    private static void HeaderCell(TableCellDescriptor table, string value, bool rightAligned = false)
    {
        var cell = table.Cell().Element(HeaderCellContainer);
        if (rightAligned) cell = cell.AlignRight();
        cell.Text(value.ToUpperInvariant()).FontSize(6.2f).Bold().LetterSpacing(.035f).FontColor(Navy);
    }

    private static void BodyCell(
        TableDescriptor table,
        string value,
        int rowIndex,
        bool semiBold = false,
        string color = Text,
        bool centered = false,
        bool rightAligned = false)
    {
        var cell = table.Cell().Element(item => BodyCellContainer(item, rowIndex));
        if (centered) cell = cell.AlignCenter();
        if (rightAligned) cell = cell.AlignRight();
        var text = cell.Text(string.IsNullOrWhiteSpace(value) ? "-" : value).FontSize(7.2f).FontColor(color);
        if (semiBold) text.SemiBold();
    }

    private static IContainer HeaderCellContainer(IContainer container) =>
        container.BorderBottom(1).BorderColor(Border).Background(NavySoft).PaddingVertical(7).PaddingHorizontal(6);

    private static IContainer BodyCellContainer(IContainer container, int rowIndex) =>
        container.BorderBottom(1).BorderColor(Border).Background(rowIndex % 2 == 0 ? White : Surface).PaddingVertical(5).PaddingHorizontal(6);

    private static string CreateFingerprint(string content, string sourceFileName)
    {
        var canonical = $"{sourceFileName}\n{content.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n')}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    private static string FormatDate(string value)
    {
        if (value.Length == 8)
        {
            return $"{value[..4]}-{value.Substring(4, 2)}-{value.Substring(6, 2)}";
        }

        return value;
    }

    private sealed record EvolisReport(string SourceFileName, string GeneratedAt, List<EvolisTableSection> Tables, string GrandTotal)
    {
        public static EvolisReport Parse(string content, string sourceFileName)
        {
            var tables = ParseTables(content);
            var grandTotal = tables.Sum(table => decimal.Parse(table.Subtotal, CultureInfo.InvariantCulture)).ToString("0.0000", CultureInfo.InvariantCulture);
            var generatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'", CultureInfo.InvariantCulture);

            return new EvolisReport(sourceFileName, generatedAt, tables, grandTotal);
        }
    }

    private sealed class EvolisTableSection
    {
        public string Title { get; set; } = string.Empty;
        public string IdPanier { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public List<EvolisLineRow> LineRows { get; } = new();
        public List<EvolisConfiguredRow> ConfiguredRows { get; } = new();
        public string Subtotal { get; set; } = "0.0000";
    }

    private sealed record EvolisLineRow(string Quantity, string GenericPartNumber);

    private sealed record EvolisConfiguredRow(string GenericPartNumber, string Quantity, string Description, string UnitPrice, string TotalPrice);

    private static List<EvolisTableSection> ParseTables(string content)
    {
        var lines = content.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n').Split('\n');
        var tables = new List<EvolisTableSection>();
        EvolisTableSection? current = null;

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd();

            if (string.IsNullOrWhiteSpace(line) || line == ";" || line.StartsWith('#'))
            {
                continue;
            }

            if (line.StartsWith("TABLEAU ", StringComparison.OrdinalIgnoreCase))
            {
                current = new EvolisTableSection { Title = line[8..].Trim() };
                tables.Add(current);
                continue;
            }

            if (current is null)
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(current.IdPanier))
            {
                current.IdPanier = line.Trim();
                continue;
            }

            if (string.IsNullOrWhiteSpace(current.Date))
            {
                current.Date = line.Trim();
                continue;
            }

            if (line.StartsWith("L,", StringComparison.OrdinalIgnoreCase))
            {
                var parts = line.Split(',', 3);
                if (parts.Length == 3)
                {
                    current.LineRows.Add(new EvolisLineRow(parts[1].Trim(), parts[2].Trim()));
                }

                continue;
            }

            if (line.StartsWith("C,", StringComparison.OrdinalIgnoreCase))
            {
                var parts = line.Split(',', 6);
                if (parts.Length == 6)
                {
                    current.ConfiguredRows.Add(new EvolisConfiguredRow(
                        parts[1].Trim(),
                        parts[2].Trim(),
                        parts[3].Trim(),
                        parts[5].Trim(),
                        MultiplyPrice(parts[5].Trim(), parts[2].Trim())));
                }
            }
        }

        foreach (var table in tables)
        {
            table.Subtotal = table.ConfiguredRows
                .Select(row => decimal.Parse(row.TotalPrice, CultureInfo.InvariantCulture))
                .Sum()
                .ToString("0.0000", CultureInfo.InvariantCulture);
        }

        return tables;
    }

    private static string MultiplyPrice(string unitPrice, string quantity)
    {
        var price = decimal.Parse(unitPrice, CultureInfo.InvariantCulture);
        var qty = decimal.Parse(quantity, CultureInfo.InvariantCulture);
        return (price * qty).ToString("0.0000", CultureInfo.InvariantCulture);
    }
}
