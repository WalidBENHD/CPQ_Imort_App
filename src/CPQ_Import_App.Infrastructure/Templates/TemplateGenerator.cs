using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Metadata;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System.Drawing;

namespace CPQ_Import_App.Infrastructure.Templates;

/// <summary>Generates pre-formatted Excel import templates with example rows.</summary>
public static class TemplateGenerator
{
    static TemplateGenerator() => ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;

    private static readonly Dictionary<EntityType, (string[] Headers, string[] ExampleRow, string SheetName)> Templates = new()
    {
        [EntityType.Article] = (
            ["ArticleNumber", "Name", "Category", "Unit"],
            ["PDU-100245", "Industrial PDU", "Standard", "PC"],
            "ArticleMaster"
        ),
        [EntityType.PriceList] = (
            ["ArticleNumber", "UnitPrice", "Currency", "ValidFrom", "ValidTo"],
            ["PDU-100245", "125.50", "EUR", "2026-01-01", "2026-12-31"],
            "BasisPrice"
        )
    };

    public static byte[] Generate(EntityType entityType)
    {
        if (!Templates.TryGetValue(entityType, out var template))
            throw new ArgumentException($"No template defined for dataset '{entityType}'.");

        var (headers, exampleRow, sheetName) = template;
        var dataset = DatasetCatalog.Get(entityType);

        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add(sheetName);

        // Header row
        for (int c = 0; c < headers.Length; c++)
        {
            var cell = ws.Cells[1, c + 1];
            cell.Value = headers[c];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(0x1F, 0x49, 0x7D));
            cell.Style.Font.Color.SetColor(Color.White);
            cell.Style.Border.Bottom.Style = ExcelBorderStyle.Thin;
        }

        // Example row (row 2) in light grey
        for (int c = 0; c < exampleRow.Length; c++)
        {
            var cell = ws.Cells[2, c + 1];
            cell.Value = exampleRow[c];
            cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
            cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(0xF2, 0xF2, 0xF2));
            cell.Style.Font.Italic = true;
            cell.Style.Font.Color.SetColor(Color.FromArgb(0x66, 0x66, 0x66));
        }

        if (ws.Dimension is not null)
        {
            ws.Cells[ws.Dimension.Address].AutoFitColumns();
        }
        ws.View.FreezePanes(2, 1);

        // Instructions sheet
        var instructions = package.Workbook.Worksheets.Add("Instructions");
        instructions.Cells[1, 1].Value = $"Dataset Template - {dataset.DisplayName}";
        instructions.Cells[1, 1].Style.Font.Bold = true;
        instructions.Cells[1, 1].Style.Font.Size = 14;
        instructions.Cells[2, 1].Value = "- Row 2 (grey/italic) is an example row - replace or delete it before uploading.";
        instructions.Cells[3, 1].Value = "- All column headers must be kept exactly as-is (case-insensitive).";
        instructions.Cells[4, 1].Value = "- Dates must be in YYYY-MM-DD format.";
        instructions.Cells[5, 1].Value = "- Currency codes must be 3-letter ISO 4217 codes (e.g. EUR, USD, GBP).";
        instructions.Cells[6, 1].Value = "- Required fields: " + GetRequiredFields(entityType);
        instructions.Column(1).Width = 80;

        return package.GetAsByteArray();
    }

    private static string GetRequiredFields(EntityType entityType) => entityType switch
    {
        EntityType.Article => "ArticleNumber, Name",
        EntityType.PriceList => "ArticleNumber, UnitPrice, Currency, ValidFrom",
        _ => "-"
    };
}
