using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Infrastructure.Parsers;

/// <summary>
/// Parses price list import files.
/// Expected columns: ArticleNumber, Price, Currency, ValidFrom, ValidTo
/// </summary>
public class PriceListParser : IFileParser
{
    private static readonly string[] ExpectedHeaders = ["ArticleNumber", "Price", "Currency", "ValidFrom", "ValidTo"];

    public EntityType SupportedEntityType => EntityType.PriceList;

    public bool CanParse(string fileName, EntityType entityType) =>
        entityType == EntityType.PriceList;

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
        RowValidator.RequireField(fields, "ArticleNumber", msgs);
        RowValidator.RequireField(fields, "Price", msgs);
        RowValidator.RequireField(fields, "Currency", msgs);
        RowValidator.RequireField(fields, "ValidFrom", msgs);
        RowValidator.RequireDecimal(fields, "Price", msgs);
        RowValidator.RequireDate(fields, "ValidFrom", msgs);
        RowValidator.RequireDate(fields, "ValidTo", msgs);
        RowValidator.MaxLength(fields, "Currency", 3, msgs);

        if (fields.TryGetValue("Currency", out var cur) && !string.IsNullOrWhiteSpace(cur)
            && (cur.Length != 3 || !cur.All(char.IsLetter)))
        {
            msgs.Add(new ValidationMessage
            {
                Field = "Currency",
                Message = $"Currency must be a 3-letter ISO 4217 code (got '{cur}').",
                Severity = ValidationSeverity.Error
            });
        }

        return msgs;
    }
}
