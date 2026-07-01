using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Infrastructure.Parsers;

/// <summary>
/// Parses currency rate import files.
/// Expected columns: FromCurrency, ToCurrency, Rate, ValidFrom
/// </summary>
public class CurrencyRateParser : IFileParser
{
    private static readonly string[] ExpectedHeaders = ["FromCurrency", "ToCurrency", "Rate", "ValidFrom"];

    public EntityType SupportedEntityType => EntityType.CurrencyRate;

    public bool CanParse(string fileName, EntityType entityType) =>
        entityType == EntityType.CurrencyRate;

    public List<ValidationMessage> ValidateRow(Dictionary<string, string?> fields)
        => Validate(fields);

    public async Task<IReadOnlyList<ParsedRow>> ParseAsync(Stream fileStream, string fileName,
        CancellationToken ct = default)
    {
        var (headers, rawRows) = await RawFileReader.ReadAsync(fileStream, fileName, ct);

        var missingHeaders = ExpectedHeaders.Except(headers, StringComparer.OrdinalIgnoreCase).ToList();
        if (missingHeaders.Count > 0)
            throw new InvalidDataException(
                $"Missing required columns: {string.Join(", ", missingHeaders)}. " +
                $"Expected: {string.Join(", ", ExpectedHeaders)}");

        var results = new List<ParsedRow>();
        for (int i = 0; i < rawRows.Count; i++)
        {
            var fields = rawRows[i];
            var msgs = Validate(fields);

            results.Add(new ParsedRow(i + 2, fields, msgs, RowValidator.DeriveStatus(msgs)));
        }
        return results;
    }

    private static List<ValidationMessage> Validate(Dictionary<string, string?> fields)
    {
        var msgs = new List<ValidationMessage>();
        RowValidator.RequireField(fields, "FromCurrency", msgs);
        RowValidator.RequireField(fields, "ToCurrency", msgs);
        RowValidator.RequireField(fields, "Rate", msgs);
        RowValidator.RequireField(fields, "ValidFrom", msgs);
        RowValidator.RequireDecimal(fields, "Rate", msgs);
        RowValidator.RequireDate(fields, "ValidFrom", msgs);

        foreach (var curField in new[] { "FromCurrency", "ToCurrency" })
        {
            if (fields.TryGetValue(curField, out var cur) && !string.IsNullOrWhiteSpace(cur)
                && (cur.Length != 3 || !cur.All(char.IsLetter)))
            {
                msgs.Add(new ValidationMessage
                {
                    Field = curField,
                    Message = $"'{curField}' must be a 3-letter ISO 4217 code (got '{cur}').",
                    Severity = ValidationSeverity.Error
                });
            }
        }

        if (fields.TryGetValue("Rate", out var rateStr)
            && decimal.TryParse(rateStr, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var rate)
            && rate <= 0)
        {
            msgs.Add(new ValidationMessage
            {
                Field = "Rate",
                Message = "Rate must be a positive number.",
                Severity = ValidationSeverity.Error
            });
        }

        return msgs;
    }
}
