using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;

namespace CPQ_Import_App.Infrastructure.Parsers;

/// <summary>
/// Parses article import files.
/// Expected columns: ArticleNumber, Name, Category, Unit
/// </summary>
public class ArticleParser : IFileParser
{
    private static readonly string[] ExpectedHeaders = ["ArticleNumber", "Name", "Category", "Unit"];

    public EntityType SupportedEntityType => EntityType.Article;

    public bool CanParse(string fileName, EntityType entityType) =>
        entityType == EntityType.Article;

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
        RowValidator.RequireField(fields, "Name", msgs);
        RowValidator.MaxLength(fields, "ArticleNumber", 50, msgs);
        RowValidator.MaxLength(fields, "Name", 255, msgs);
        RowValidator.MaxLength(fields, "Category", 100, msgs);
        RowValidator.MaxLength(fields, "Unit", 20, msgs);
        return msgs;
    }
}
