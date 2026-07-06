using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CPQ_Import_App.API.Services;

public sealed class EvolisPdfDocumentBuilder
{
    private const string Accent = "#2563EB";
    private const string AccentSoft = "#DBEAFE";
    private const string AccentUltraSoft = "#EFF6FF";
    private const string TextDark = "#0F172A";
    private const string TextMuted = "#475569";
    private const string Border = "#CBD5E1";
    private const string HeaderFill = "#EFF6FF";
    private const string RowAltFill = "#F8FAFC";
    private const string White = "#FFFFFF";

    public byte[] Build(string decryptedContent, string sourceFileName)
    {
        var report = EvolisReport.Parse(decryptedContent, sourceFileName);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(26);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(style => style.FontFamily("Aptos").FontSize(10).FontColor(TextDark));

                page.Header().Element(header => ComposeHeader(header, report));
                page.Content().PaddingTop(14).Element(content => ComposeContent(content, report));
                page.Footer().PaddingTop(8).AlignRight().Text(text =>
                {
                    text.Span("Page ").FontSize(9).FontColor(TextMuted);
                    text.CurrentPageNumber().FontSize(9).FontColor(TextMuted);
                    text.Span(" / ").FontSize(9).FontColor(TextMuted);
                    text.TotalPages().FontSize(9).FontColor(TextMuted);
                });
            });
        }).GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, EvolisReport report)
    {
        container.Background(Accent).Padding(18).Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item().Text("Evolis Decryptor Report").FontSize(24).SemiBold().FontColor(Colors.White);
                column.Item().PaddingTop(4).Text($"Source file: {report.SourceFileName}").FontSize(10).FontColor(AccentUltraSoft);
                column.Item().Text($"Generated: {report.GeneratedAt}").FontSize(9).FontColor(AccentUltraSoft);
            });

            row.ConstantItem(210).AlignRight().Background(AccentSoft).Padding(12).Column(column =>
            {
                column.Item().Text("Tables").FontSize(10).SemiBold().FontColor(Accent);
                column.Item().Text(report.Tables.Count.ToString(CultureInfo.InvariantCulture)).FontSize(22).SemiBold().FontColor(TextDark);
                column.Item().PaddingTop(8).Text("Grand total").FontSize(10).SemiBold().FontColor(Accent);
                column.Item().Text(report.GrandTotal).FontSize(18).SemiBold().FontColor(TextDark);
            });
        });
    }

    private static void ComposeContent(IContainer container, EvolisReport report)
    {
        container.Column(column =>
        {
            column.Spacing(14);

            foreach (var table in report.Tables)
            {
                column.Item().Background(Colors.White).Border(1).BorderColor(Border).Padding(14).Column(section =>
                {
                    section.Spacing(10);

                    section.Item().Text(table.Title).FontSize(16).SemiBold().FontColor(Accent);
                    section.Item().Row(row =>
                    {
                        row.RelativeItem().Text($"Basket: {table.IdPanier}").FontSize(10).FontColor(TextMuted);
                        row.RelativeItem().AlignRight().Text($"Date: {FormatDate(table.Date)}").FontSize(10).FontColor(TextMuted);
                    });

                    if (table.LineRows.Count > 0)
                    {
                        section.Item().PaddingTop(4).Text("Standard rows").FontSize(11).SemiBold().FontColor(TextDark);
                        section.Item().Table(tableBuilder =>
                        {
                            tableBuilder.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(42);
                                columns.RelativeColumn(1.2f);
                                columns.RelativeColumn(2.2f);
                            });

                            tableBuilder.Header(header =>
                            {
                                header.Cell().Element(TableHeaderCell).Text("Type");
                                header.Cell().Element(TableHeaderCell).Text("Generic part number");
                                header.Cell().Element(TableHeaderCell).Text("Quantity");
                            });

                            var rowIndex = 0;
                            foreach (var lineRow in table.LineRows)
                            {
                                var alternate = rowIndex % 2 == 1;
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate, alignLeft: false)).Text("L").SemiBold();
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate)).Text(lineRow.Quantity);
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate)).Text(lineRow.GenericPartNumber);
                                rowIndex++;
                            }
                        });
                    }

                    if (table.ConfiguredRows.Count > 0)
                    {
                        section.Item().PaddingTop(4).Text("Configured rows").FontSize(11).SemiBold().FontColor(TextDark);
                        section.Item().Table(tableBuilder =>
                        {
                            tableBuilder.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(42);
                                columns.RelativeColumn(1.6f);
                                columns.RelativeColumn(0.9f);
                                columns.RelativeColumn(2.8f);
                                columns.RelativeColumn(1.0f);
                                columns.RelativeColumn(1.0f);
                            });

                            tableBuilder.Header(header =>
                            {
                                header.Cell().Element(TableHeaderCell).Text("Type");
                                header.Cell().Element(TableHeaderCell).Text("Generic part number");
                                header.Cell().Element(TableHeaderCell).Text("Qty");
                                header.Cell().Element(TableHeaderCell).Text("Description");
                                header.Cell().Element(TableHeaderCell).Text("Unit price");
                                header.Cell().Element(TableHeaderCell).Text("Total price");
                            });

                            var rowIndex = 0;
                            foreach (var configuredRow in table.ConfiguredRows)
                            {
                                var alternate = rowIndex % 2 == 1;
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate, alignLeft: false)).Text("C").SemiBold();
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate)).Text(configuredRow.GenericPartNumber);
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate)).Text(configuredRow.Quantity);
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate)).Text(configuredRow.Description);
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate, alignRight: true)).Text(configuredRow.UnitPrice);
                                tableBuilder.Cell().Element(cell => TableBodyCell(cell, alternate, alignRight: true)).Text(configuredRow.TotalPrice).SemiBold().FontColor(Accent);
                                rowIndex++;
                            }
                        });
                    }

                    section.Item().PaddingTop(4).AlignRight().Background(AccentSoft).PaddingVertical(10).PaddingHorizontal(14).Text($"Subtotal: {table.Subtotal}").FontSize(11).SemiBold().FontColor(TextDark);
                });
            }

            column.Item().Background(Accent).Padding(14).Text($"Grand total: {report.GrandTotal}").FontSize(16).SemiBold().FontColor(Colors.White);
        });
    }

    private static IContainer TableHeaderCell(IContainer container)
    {
        return container.BorderBottom(1).BorderColor(Border).Background(HeaderFill).PaddingVertical(8).PaddingHorizontal(8);
    }

    private static IContainer TableBodyCell(IContainer container, bool alternate, bool alignLeft = true, bool alignRight = false)
    {
        if (alignRight)
        {
            container = container.AlignRight();
        }
        else if (!alignLeft)
        {
            container = container.AlignCenter();
        }

        return container.BorderBottom(1).BorderColor(Border).Background(alternate ? RowAltFill : White).PaddingVertical(7).PaddingHorizontal(8);
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