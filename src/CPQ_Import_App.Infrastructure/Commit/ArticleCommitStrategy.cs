using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Npgsql;
using System.Data.Common;

namespace CPQ_Import_App.Infrastructure.Commit;

/// <summary>
/// Upserts articles into the CPQ [dbo].[CpqArticles] table.
/// MERGE logic: match on ArticleNumber, update Name/Category/Unit, insert if new.
/// </summary>
public class ArticleCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.Article;

    public async Task CommitRowsAsync(
        IEnumerable<Dictionary<string, string?>> rows,
        IReadOnlyCollection<string> removedKeys,
        CancellationToken ct = default)
    {
        if (CommitConnectionResolver.ShouldUsePostgres(config))
        {
            await CommitRowsPostgresAsync(rows, removedKeys, ct);
            return;
        }

        const string sql = """
            MERGE [dbo].[CpqArticles] AS target
            USING (SELECT @ArticleNumber AS ArticleNumber) AS source ON target.ArticleNumber = source.ArticleNumber
            WHEN MATCHED THEN
                UPDATE SET Name = @Name, Category = @Category, Unit = @Unit, UpdatedAt = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ArticleNumber, Name, Category, Unit, CreatedAt, UpdatedAt)
                VALUES (@ArticleNumber, @Name, @Category, @Unit, GETUTCDATE(), GETUTCDATE());
            """;

        await using var conn = new SqlConnection(CommitConnectionResolver.GetSqlServerConnectionString(config));
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        try
        {
            foreach (var row in rows)
            {
                ct.ThrowIfCancellationRequested();
                await conn.ExecuteAsync(sql, new
                {
                    ArticleNumber = row.GetValueOrDefault("ArticleNumber"),
                    Name = row.GetValueOrDefault("Name"),
                    Category = row.GetValueOrDefault("Category"),
                    Unit = row.GetValueOrDefault("Unit")
                }, tx);
            }

            if (removedKeys.Count > 0)
            {
                var articleNumbers = removedKeys
                    .Where(key => !string.IsNullOrWhiteSpace(key))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (articleNumbers.Length > 0)
                {
                    await conn.ExecuteAsync("""
                        DELETE FROM [dbo].[CpqArticleDescriptions]
                        WHERE [ArticleNumber] IN @ArticleNumbers;

                        DELETE FROM [dbo].[CpqArticlePrices]
                        WHERE [ArticleNumber] IN @ArticleNumbers;

                        DELETE a
                        FROM [dbo].[CpqArticles] AS a
                        WHERE a.[ArticleNumber] IN @ArticleNumbers
                          AND NOT EXISTS (
                              SELECT 1 FROM [dbo].[CpqArticleDescriptions] d WHERE d.[ArticleNumber] = a.[ArticleNumber]
                          )
                          AND NOT EXISTS (
                              SELECT 1 FROM [dbo].[CpqArticlePrices] p WHERE p.[ArticleNumber] = a.[ArticleNumber]
                          );
                        """, new { ArticleNumbers = articleNumbers }, tx);
                }
            }

            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    private async Task CommitRowsPostgresAsync(IEnumerable<Dictionary<string, string?>> rows, IReadOnlyCollection<string> removedKeys, CancellationToken ct)
    {
        const string ensureSql = """
            CREATE SCHEMA IF NOT EXISTS dbo;
            CREATE TABLE IF NOT EXISTS dbo."CpqArticles" (
                "ArticleNumber" text PRIMARY KEY,
                "Name" text,
                "Category" text,
                "Unit" text,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
            );
            """;

        const string upsertSql = """
            INSERT INTO dbo."CpqArticles" ("ArticleNumber", "Name", "Category", "Unit", "CreatedAt", "UpdatedAt")
            VALUES (@ArticleNumber, @Name, @Category, @Unit, NOW(), NOW())
            ON CONFLICT ("ArticleNumber") DO UPDATE
            SET "Name" = EXCLUDED."Name",
                "Category" = EXCLUDED."Category",
                "Unit" = EXCLUDED."Unit",
                "UpdatedAt" = NOW();
            """;

        await using var conn = new NpgsqlConnection(CommitConnectionResolver.GetPostgresConnectionString(config));
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        try
        {
            await conn.ExecuteAsync(ensureSql, transaction: tx);

            foreach (var row in rows)
            {
                ct.ThrowIfCancellationRequested();
                await conn.ExecuteAsync(upsertSql, new
                {
                    ArticleNumber = row.GetValueOrDefault("ArticleNumber"),
                    Name = row.GetValueOrDefault("Name"),
                    Category = row.GetValueOrDefault("Category"),
                    Unit = row.GetValueOrDefault("Unit")
                }, tx);
            }

            if (removedKeys.Count > 0)
            {
                var articleNumbers = removedKeys
                    .Where(key => !string.IsNullOrWhiteSpace(key))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (articleNumbers.Length > 0)
                {
                    await conn.ExecuteAsync("""
                        DELETE FROM dbo."CpqArticleDescriptions"
                        WHERE "ArticleNumber" = ANY(@ArticleNumbers);

                        DELETE FROM dbo."CpqArticlePrices"
                        WHERE "ArticleNumber" = ANY(@ArticleNumbers);

                        DELETE FROM dbo."CpqArticles" AS a
                        WHERE a."ArticleNumber" = ANY(@ArticleNumbers)
                          AND NOT EXISTS (
                              SELECT 1 FROM dbo."CpqArticleDescriptions" d WHERE d."ArticleNumber" = a."ArticleNumber"
                          )
                          AND NOT EXISTS (
                              SELECT 1 FROM dbo."CpqArticlePrices" p WHERE p."ArticleNumber" = a."ArticleNumber"
                          );
                        """, new { ArticleNumbers = articleNumbers }, tx);
                }
            }

            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

}
