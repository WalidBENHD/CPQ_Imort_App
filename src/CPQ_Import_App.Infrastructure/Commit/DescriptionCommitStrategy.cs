using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace CPQ_Import_App.Infrastructure.Commit;

public class DescriptionCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.Description;

    public async Task CommitRowsAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct = default)
    {
        if (CommitConnectionResolver.ShouldUsePostgres(config))
        {
            await CommitRowsPostgresAsync(rows, ct);
            return;
        }

        const string sql = """
            MERGE [dbo].[CpqArticleDescriptions] AS target
            USING (SELECT @ArticleNumber AS ArticleNumber, @LanguageCode AS LanguageCode) AS source
                ON target.ArticleNumber = source.ArticleNumber
                AND target.LanguageCode = source.LanguageCode
            WHEN MATCHED THEN
                UPDATE SET ShortDescription = @ShortDescription, LongDescription = @LongDescription, UpdatedAt = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ArticleNumber, LanguageCode, ShortDescription, LongDescription, CreatedAt, UpdatedAt)
                VALUES (@ArticleNumber, @LanguageCode, @ShortDescription, @LongDescription, GETUTCDATE(), GETUTCDATE());
            """;

        const string ensureArticleSql = """
            MERGE [dbo].[CpqArticles] AS target
            USING (SELECT @ArticleNumber AS ArticleNumber) AS source
                ON target.ArticleNumber = source.ArticleNumber
            WHEN NOT MATCHED THEN
                INSERT (ArticleNumber, Name, Category, Unit, CreatedAt, UpdatedAt)
                VALUES (@ArticleNumber, @ArticleNumber, NULL, NULL, GETUTCDATE(), GETUTCDATE());
            """;

        await using var conn = new SqlConnection(CommitConnectionResolver.GetSqlServerConnectionString(config));
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        try
        {
            foreach (var row in rows)
            {
                ct.ThrowIfCancellationRequested();
                await conn.ExecuteAsync(ensureArticleSql, new
                {
                    ArticleNumber = row.GetValueOrDefault("ArticleNumber")
                }, tx);
                await conn.ExecuteAsync(sql, new
                {
                    ArticleNumber = row.GetValueOrDefault("ArticleNumber"),
                    LanguageCode = row.GetValueOrDefault("LanguageCode"),
                    ShortDescription = row.GetValueOrDefault("ShortDescription"),
                    LongDescription = row.GetValueOrDefault("LongDescription")
                }, tx);
            }
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    private async Task CommitRowsPostgresAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct)
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
            CREATE TABLE IF NOT EXISTS dbo."CpqArticleDescriptions" (
                "ArticleNumber" text NOT NULL,
                "LanguageCode" text NOT NULL,
                "ShortDescription" text,
                "LongDescription" text,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_CpqArticleDescriptions" PRIMARY KEY ("ArticleNumber", "LanguageCode")
            );
            """;

        const string ensureArticleSql = """
            INSERT INTO dbo."CpqArticles" ("ArticleNumber", "Name", "Category", "Unit", "CreatedAt", "UpdatedAt")
            VALUES (@ArticleNumber, @ArticleNumber, NULL, NULL, NOW(), NOW())
            ON CONFLICT ("ArticleNumber") DO NOTHING;
            """;

        const string upsertSql = """
            INSERT INTO dbo."CpqArticleDescriptions" ("ArticleNumber", "LanguageCode", "ShortDescription", "LongDescription", "CreatedAt", "UpdatedAt")
            VALUES (@ArticleNumber, @LanguageCode, @ShortDescription, @LongDescription, NOW(), NOW())
            ON CONFLICT ("ArticleNumber", "LanguageCode") DO UPDATE
            SET "ShortDescription" = EXCLUDED."ShortDescription",
                "LongDescription" = EXCLUDED."LongDescription",
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

                var articleNumber = row.GetValueOrDefault("ArticleNumber");
                var languageCode = row.GetValueOrDefault("LanguageCode");

                if (string.IsNullOrWhiteSpace(articleNumber) || string.IsNullOrWhiteSpace(languageCode))
                {
                    continue;
                }

                await conn.ExecuteAsync(ensureArticleSql, new
                {
                    ArticleNumber = articleNumber
                }, tx);

                await conn.ExecuteAsync(upsertSql, new
                {
                    ArticleNumber = articleNumber,
                    LanguageCode = languageCode,
                    ShortDescription = row.GetValueOrDefault("ShortDescription"),
                    LongDescription = row.GetValueOrDefault("LongDescription")
                }, tx);
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
