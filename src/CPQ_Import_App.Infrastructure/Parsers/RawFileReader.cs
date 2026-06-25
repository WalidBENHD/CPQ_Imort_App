using CsvHelper;
using CsvHelper.Configuration;
using OfficeOpenXml;
using System.Globalization;

namespace CPQ_Import_App.Infrastructure.Parsers;

/// <summary>Reads rows from .xlsx or .csv into a list of header→value dictionaries.</summary>
internal static class RawFileReader
{
    static RawFileReader() => ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;

    public static async Task<(List<string> Headers, List<Dictionary<string, string?>> Rows)>
        ReadAsync(Stream stream, string fileName, CancellationToken ct)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".xlsx" or ".xls" => await ReadExcelAsync(stream, ct),
            ".csv" => await ReadCsvAsync(stream, ct),
            _ => throw new NotSupportedException($"File extension '{ext}' is not supported. Use .xlsx or .csv.")
        };
    }

    private static Task<(List<string>, List<Dictionary<string, string?>>)>
        ReadExcelAsync(Stream stream, CancellationToken ct)
    {
        using var package = new ExcelPackage(stream);
        var ws = package.Workbook.Worksheets.First();
        var headers = new List<string>();
        var rows = new List<Dictionary<string, string?>>();

        if (ws.Dimension == null) return Task.FromResult((headers, rows));

        int colCount = ws.Dimension.Columns;
        int rowCount = ws.Dimension.Rows;

        for (int c = 1; c <= colCount; c++)
            headers.Add(ws.Cells[1, c].Text.Trim());

        for (int r = 2; r <= rowCount; r++)
        {
            ct.ThrowIfCancellationRequested();
            var dict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            for (int c = 1; c <= colCount; c++)
            {
                var header = headers[c - 1];
                if (!string.IsNullOrWhiteSpace(header))
                    dict[header] = ws.Cells[r, c].Text.Trim();
            }
            // Skip completely empty rows
            if (dict.Values.Any(v => !string.IsNullOrWhiteSpace(v)))
                rows.Add(dict);
        }

        return Task.FromResult((headers, rows));
    }

    private static async Task<(List<string>, List<Dictionary<string, string?>>)>
        ReadCsvAsync(Stream stream, CancellationToken ct)
    {
        var headers = new List<string>();
        var rows = new List<Dictionary<string, string?>>();
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            TrimOptions = TrimOptions.Trim,
            MissingFieldFound = null
        };

        using var reader = new StreamReader(stream, leaveOpen: true);
        using var csv = new CsvReader(reader, config);

        await csv.ReadAsync();
        csv.ReadHeader();
        headers.AddRange(csv.HeaderRecord ?? []);

        while (await csv.ReadAsync())
        {
            ct.ThrowIfCancellationRequested();
            var dict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (var h in headers)
                dict[h] = csv.GetField(h);
            if (dict.Values.Any(v => !string.IsNullOrWhiteSpace(v)))
                rows.Add(dict);
        }

        return (headers, rows);
    }
}
