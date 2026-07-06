using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace CPQ_Import_App.API.Services;

public sealed class EvolisWordDocumentBuilder
{
    private const string Accent = "2563EB";
    private const string AccentSoft = "DBEAFE";
    private const string AccentUltraSoft = "EFF6FF";
    private const string TextDark = "0F172A";
    private const string TextMuted = "475569";
    private const string Border = "CBD5E1";
    private const string HeaderFill = "EFF6FF";
    private const string RowAltFill = "F8FAFC";

    public byte[] Build(string decryptedContent, string sourceFileName)
    {
        var tables = ParseTables(decryptedContent);
        var grandTotal = tables.Sum(table => decimal.Parse(table.Subtotal, CultureInfo.InvariantCulture));
        var generatedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm 'UTC'", CultureInfo.InvariantCulture);

        using var memoryStream = new MemoryStream();

        using (var wordDocument = WordprocessingDocument.Create(memoryStream, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDocument.AddMainDocumentPart();
            mainPart.Document = new Document(new Body());

            var body = mainPart.Document.Body!;
            ConfigureSection(body);

            body.Append(CreateTitleBlock(sourceFileName, generatedAt));
            body.Append(CreateSummaryStrip(sourceFileName, tables.Count, grandTotal));

            foreach (var table in tables)
            {
                body.Append(CreateSectionHeading(table));

                if (table.LineRows.Count > 0)
                {
                    body.Append(CreateSubHeading("Standard rows"));
                    body.Append(CreateTable(
                        new[] { "L", "Generic part number", "Quantity" },
                        table.LineRows.Select(row => new[] { "L", row.Quantity, row.GenericPartNumber })));
                }

                if (table.ConfiguredRows.Count > 0)
                {
                    body.Append(CreateSubHeading("Configured rows"));
                    body.Append(CreateTable(
                        new[] { "C", "Generic part number", "Quantity", "Description", "Unit price", "Total price" },
                        table.ConfiguredRows.Select(row => new[]
                        {
                            "C",
                            row.GenericPartNumber,
                            row.Quantity,
                            row.Description,
                            row.UnitPrice,
                            row.TotalPrice
                        })));
                }

                body.Append(CreateSubtotalStrip(table.Subtotal));
            }

            body.Append(CreateGrandTotalBlock(grandTotal));
            mainPart.Document.Save();
        }

        return memoryStream.ToArray();
    }

    private static void ConfigureSection(Body body)
    {
        body.Append(new SectionProperties(
            new PageMargin
            {
                Top = 720,
                Right = 720,
                Bottom = 720,
                Left = 720,
                Header = 360,
                Footer = 360,
                Gutter = 0
            }));
    }

    private static Paragraph CreateTitleBlock(string sourceFileName, string generatedAt)
    {
        var paragraph = new Paragraph();
        paragraph.Append(new ParagraphProperties(new SpacingBetweenLines { After = "120" }));
        paragraph.Append(CreateRun("Evolis Decryptor Report", 28, true, Accent));
        paragraph.Append(new Run(new Break()));
        paragraph.Append(CreateRun($"Source file: {sourceFileName}", 16, false, TextMuted));
        paragraph.Append(new Run(new Break()));
        paragraph.Append(CreateRun($"Generated: {generatedAt}", 14, false, TextMuted));
        return paragraph;
    }

    private static Table CreateSummaryStrip(string sourceFileName, int tableCount, decimal grandTotal)
    {
        return CreateCardTable(new[]
        {
            ("SOURCE", sourceFileName),
            ("TABLES", tableCount.ToString(CultureInfo.InvariantCulture)),
            ("GRAND TOTAL", grandTotal.ToString("0.0000", CultureInfo.InvariantCulture))
        }, accentFill: AccentUltraSoft, headerTextColor: Accent, valueTextColor: TextDark, compact: true);
    }

    private static Paragraph CreateSectionHeading(EvolisTableSection table)
    {
        var paragraph = new Paragraph();
        paragraph.Append(new ParagraphProperties(new SpacingBetweenLines { Before = "240", After = "80" }));
        paragraph.Append(CreateRun(table.Title, 22, true, Accent));
        paragraph.Append(new Run(new Break()));
        paragraph.Append(CreateRun($"Basket: {table.IdPanier}", 14, false, TextMuted));
        paragraph.Append(new Run(new Break()));
        paragraph.Append(CreateRun($"Date: {FormatDate(table.Date)}", 14, false, TextMuted));
        return paragraph;
    }

    private static Paragraph CreateSubHeading(string text)
    {
        var paragraph = new Paragraph();
        paragraph.Append(new ParagraphProperties(new SpacingBetweenLines { Before = "180", After = "60" }));
        paragraph.Append(CreateRun(text, 16, true, TextDark));
        return paragraph;
    }

    private static Table CreateSubtotalStrip(string subtotal)
    {
        return CreateCardTable(new[] { ("SUBTOTAL", subtotal) }, accentFill: AccentSoft, headerTextColor: Accent, valueTextColor: TextDark, compact: false);
    }

    private static Paragraph CreateGrandTotalBlock(decimal grandTotal)
    {
        var paragraph = new Paragraph();
        paragraph.Append(new ParagraphProperties(new SpacingBetweenLines { Before = "220", After = "120" }));
        paragraph.Append(CreateRun($"Grand total: {grandTotal:0.0000}", 18, true, Accent));
        return paragraph;
    }

    private static Run CreateRun(string text, int fontSizeHalfPoints, bool bold, string color)
    {
        var runProperties = new RunProperties(
            new Bold { Val = bold },
            new Color { Val = color },
            new FontSize { Val = fontSizeHalfPoints.ToString(CultureInfo.InvariantCulture) },
            new RunFonts { Ascii = "Aptos", HighAnsi = "Aptos" });

        return new Run(runProperties, new Text(text) { Space = SpaceProcessingModeValues.Preserve });
    }

    private static Table CreateTable(IEnumerable<string> header, IEnumerable<string[]> rows)
    {
        var table = new Table();
        table.Append(new TableProperties(
            new TableLayout { Type = TableLayoutValues.Fixed },
            new TableWidth { Type = TableWidthUnitValues.Pct, Width = "5000" },
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new BottomBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new LeftBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new RightBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new InsideHorizontalBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new InsideVerticalBorder { Val = BorderValues.Single, Color = Border, Size = 4 })));

        table.Append(CreateTableRow(header.ToArray(), true, 0));

        var index = 0;
        foreach (var row in rows)
        {
            table.Append(CreateTableRow(row, false, index));
            index++;
        }

        return table;
    }

    private static Table CreateCardTable(IEnumerable<(string Label, string Value)> cells, string accentFill, string headerTextColor, string valueTextColor, bool compact)
    {
        var table = new Table();
        table.Append(new TableProperties(
            new TableLayout { Type = TableLayoutValues.Fixed },
            new TableWidth { Type = TableWidthUnitValues.Pct, Width = "5000" },
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new BottomBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new LeftBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new RightBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new InsideHorizontalBorder { Val = BorderValues.Single, Color = Border, Size = 4 },
                new InsideVerticalBorder { Val = BorderValues.Single, Color = Border, Size = 4 })));

        var row = new TableRow();
        var cellList = cells.ToList();
        for (var i = 0; i < cellList.Count; i++)
        {
            row.Append(CreateSummaryCell(cellList[i].Label, cellList[i].Value, accentFill, headerTextColor, valueTextColor, compact));
        }

        table.Append(row);
        return table;
    }

    private static TableCell CreateSummaryCell(string label, string value, string fill, string labelColor, string valueColor, bool compact)
    {
        var cell = new TableCell();
        cell.Append(new TableCellProperties(
            new TableCellWidth { Type = TableWidthUnitValues.Pct, Width = compact ? "1666" : "5000" },
            new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = fill },
            new TableCellMargin(
                new TopMargin { Width = "120", Type = TableWidthUnitValues.Dxa },
                new BottomMargin { Width = "120", Type = TableWidthUnitValues.Dxa },
                new LeftMargin { Width = "120", Type = TableWidthUnitValues.Dxa },
                new RightMargin { Width = "120", Type = TableWidthUnitValues.Dxa })));

        var paragraph = new Paragraph();
        paragraph.Append(new ParagraphProperties(new SpacingBetweenLines { After = "0" }));
        paragraph.Append(CreateRun(label, 12, true, labelColor));
        paragraph.Append(new Run(new Break()));
        paragraph.Append(CreateRun(value, compact ? 15 : 16, true, valueColor));

        cell.Append(paragraph);
        return cell;
    }

    private static TableRow CreateTableRow(string[] values, bool header, int rowIndex)
    {
        var row = new TableRow();
        var isAlt = !header && rowIndex % 2 == 1;

        for (var i = 0; i < values.Length; i++)
        {
            row.Append(CreateTableCell(values[i], header, isAlt, i));
        }

        return row;
    }

    private static TableCell CreateTableCell(string text, bool header, bool alternate, int columnIndex)
    {
        var cell = new TableCell();
        var fill = header ? HeaderFill : alternate ? RowAltFill : "FFFFFF";
        cell.Append(new TableCellProperties(
            new TableCellWidth { Type = TableWidthUnitValues.Pct, Width = columnIndex == 0 ? "420" : "1200" },
            new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = fill },
            new TableCellVerticalAlignment { Val = TableVerticalAlignmentValues.Center },
            new TableCellMargin(
                new TopMargin { Width = "100", Type = TableWidthUnitValues.Dxa },
                new BottomMargin { Width = "100", Type = TableWidthUnitValues.Dxa },
                new LeftMargin { Width = "120", Type = TableWidthUnitValues.Dxa },
                new RightMargin { Width = "120", Type = TableWidthUnitValues.Dxa })));

        var paragraph = new Paragraph();
        paragraph.Append(new ParagraphProperties(new SpacingBetweenLines { Before = "0", After = "0" }));
        paragraph.Append(CreateRun(text, header ? 13 : 12, header, TextDark));
        cell.Append(paragraph);
        return cell;
    }

    private static string FormatDate(string value)
    {
        if (value.Length == 8)
        {
            return $"{value[..4]}-{value.Substring(4, 2)}-{value.Substring(6, 2)}";
        }

        return value;
    }

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
}
