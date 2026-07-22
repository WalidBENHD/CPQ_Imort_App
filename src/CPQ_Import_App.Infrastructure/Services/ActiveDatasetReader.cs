using System.Data.Common;
using System.Globalization;
using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Commit;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace CPQ_Import_App.Infrastructure.Services;

public sealed class ActiveDatasetReader(IConfiguration config) : IActiveDatasetReader
{
    public async Task<IReadOnlyList<ActiveDatasetRecord>> GetRecordsAsync(
        EntityType entityType,
        CancellationToken ct = default)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(ct);

        try
        {
            var rows = (await connection.QueryAsync(
                new CommandDefinition(SqlFor(entityType), cancellationToken: ct))).Cast<object>();
            return rows.Select((row, index) => ToRecord(entityType, row, index)).ToList();
        }
        catch (SqlException ex) when (ex.Number == 208)
        {
            return [];
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            return [];
        }
    }

    private DbConnection CreateConnection()
        => CommitConnectionResolver.ShouldUsePostgres(config)
            ? new NpgsqlConnection(CommitConnectionResolver.GetPostgresConnectionString(config))
            : new SqlConnection(CommitConnectionResolver.GetSqlServerConnectionString(config));

    private string SqlFor(EntityType entityType)
    {
        var postgres = CommitConnectionResolver.ShouldUsePostgres(config);
        return (entityType, postgres) switch
        {
            (EntityType.Article, true) => """
                SELECT "ArticleNumber", "Name", "Category", "Unit"
                FROM dbo."CpqArticles"
                ORDER BY "ArticleNumber";
                """,
            (EntityType.Article, false) => """
                SELECT [ArticleNumber], [Name], [Category], [Unit]
                FROM [dbo].[CpqArticles]
                ORDER BY [ArticleNumber];
                """,
            (EntityType.PriceList, true) => """
                SELECT "ArticleNumber", "Price" AS "UnitPrice", "Currency", "ValidFrom", "ValidTo"
                FROM dbo."CpqArticlePrices"
                ORDER BY "ArticleNumber", "Currency", "ValidFrom";
                """,
            (EntityType.PriceList, false) => """
                SELECT [ArticleNumber], [Price] AS [UnitPrice], [Currency], [ValidFrom], [ValidTo]
                FROM [dbo].[CpqArticlePrices]
                ORDER BY [ArticleNumber], [Currency], [ValidFrom];
                """,
            (EntityType.Description, true) => """
                SELECT "ArticleNumber", "LanguageCode", "ShortDescription", "LongDescription"
                FROM dbo."CpqArticleDescriptions"
                ORDER BY "ArticleNumber", "LanguageCode";
                """,
            (EntityType.Description, false) => """
                SELECT [ArticleNumber], [LanguageCode], [ShortDescription], [LongDescription]
                FROM [dbo].[CpqArticleDescriptions]
                ORDER BY [ArticleNumber], [LanguageCode];
                """,
            (EntityType.CurrencyRate, true) => """
                SELECT "FromCurrency", "ToCurrency", "Rate", "ValidFrom"
                FROM dbo."CpqCurrencyRates"
                ORDER BY "FromCurrency", "ToCurrency", "ValidFrom";
                """,
            (EntityType.CurrencyRate, false) => """
                SELECT [FromCurrency], [ToCurrency], [Rate], [ValidFrom]
                FROM [dbo].[CpqCurrencyRates]
                ORDER BY [FromCurrency], [ToCurrency], [ValidFrom];
                """,
            _ => throw new InvalidDataException($"Dataset '{entityType}' is not supported.")
        };
    }

    private static ActiveDatasetRecord ToRecord(EntityType entityType, object row, int index)
    {
        var fields = ((IDictionary<string, object?>)row)
            .ToDictionary(pair => pair.Key, pair => FormatValue(pair.Value), StringComparer.OrdinalIgnoreCase);
        return new ActiveDatasetRecord(entityType, BuildKey(entityType, fields, index), fields);
    }

    private static string BuildKey(EntityType entityType, IReadOnlyDictionary<string, string?> fields, int index)
        => entityType switch
        {
            EntityType.Article => fields.GetValueOrDefault("ArticleNumber") ?? $"article-{index}",
            EntityType.PriceList => JoinKey(fields, "ArticleNumber", "Currency", "ValidFrom"),
            EntityType.Description => JoinKey(fields, "ArticleNumber", "LanguageCode"),
            EntityType.CurrencyRate => JoinKey(fields, "FromCurrency", "ToCurrency", "ValidFrom"),
            _ => $"record-{index}"
        };

    private static string JoinKey(IReadOnlyDictionary<string, string?> fields, params string[] names)
        => string.Join('|', names.Select(name => fields.GetValueOrDefault(name) ?? string.Empty));

    private static string? FormatValue(object? value)
        => value switch
        {
            null or DBNull => null,
            DateTime date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            DateTimeOffset date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            decimal number => number.ToString(CultureInfo.InvariantCulture),
            double number => number.ToString(CultureInfo.InvariantCulture),
            float number => number.ToString(CultureInfo.InvariantCulture),
            IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString()
        };
}
