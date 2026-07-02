using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Infrastructure.Parsers;

/// <summary>
/// Parses description/translation import files.
/// Expected columns: ArticleNumber, LanguageCode, ShortDescription, LongDescription
/// </summary>
public class DescriptionParser : IFileParser
{
    private static readonly string[] ExpectedHeaders = ["ArticleNumber", "LanguageCode", "ShortDescription", "LongDescription"];

    public EntityType SupportedEntityType => EntityType.Description;

    public bool CanParse(string fileName, EntityType entityType) =>
        entityType == EntityType.Description;

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
        RowValidator.NoWhitespace(fields, "ArticleNumber", msgs);
        RowValidator.RequireField(fields, "LanguageCode", msgs);
        RowValidator.RequireField(fields, "ShortDescription", msgs);
        RowValidator.MaxLength(fields, "LanguageCode", 10, msgs);
        RowValidator.MaxLength(fields, "ShortDescription", 255, msgs);
        RowValidator.MaxLength(fields, "LongDescription", 4000, msgs);
        return msgs;
    }
}
