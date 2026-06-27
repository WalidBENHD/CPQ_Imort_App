using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace CPQ_Import_App.Infrastructure.Commit;

public class PriceListCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.PriceList;

    public async Task CommitRowsAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct = default)
    {
        if (CommitConnectionResolver.ShouldUsePostgres(config))
        {
            await CommitRowsPostgresAsync(rows, ct);
            return;
        }

        const string sql = """
            MERGE [dbo].[CpqArticlePrices] AS target
            USING (SELECT @ArticleNumber AS ArticleNumber, @Currency AS Currency, @ValidFrom AS ValidFrom) AS source
                ON target.ArticleNumber = source.ArticleNumber
                AND target.Currency = source.Currency
                AND target.ValidFrom = source.ValidFrom
            WHEN MATCHED THEN
                UPDATE SET Price = @Price, ValidTo = @ValidTo, UpdatedAt = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ArticleNumber, Price, Currency, ValidFrom, ValidTo, CreatedAt, UpdatedAt)
                VALUES (@ArticleNumber, @Price, @Currency, @ValidFrom, @ValidTo, GETUTCDATE(), GETUTCDATE());
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
                    Price = row.GetValueOrDefault("Price"),
                    Currency = row.GetValueOrDefault("Currency"),
                    ValidFrom = row.GetValueOrDefault("ValidFrom"),
                    ValidTo = row.GetValueOrDefault("ValidTo")
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
            CREATE TABLE IF NOT EXISTS dbo."CpqArticlePrices" (
                "ArticleNumber" text NOT NULL,
                "Price" numeric(18,4) NOT NULL,
                "Currency" text NOT NULL,
                "ValidFrom" timestamp with time zone NOT NULL,
                "ValidTo" timestamp with time zone NULL,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_CpqArticlePrices" PRIMARY KEY ("ArticleNumber", "Currency", "ValidFrom")
            );
            """;

        const string ensureArticleSql = """
            INSERT INTO dbo."CpqArticles" ("ArticleNumber", "Name", "Category", "Unit", "CreatedAt", "UpdatedAt")
            VALUES (@ArticleNumber, @ArticleNumber, NULL, NULL, NOW(), NOW())
            ON CONFLICT ("ArticleNumber") DO NOTHING;
            """;

        const string upsertSql = """
            INSERT INTO dbo."CpqArticlePrices" ("ArticleNumber", "Price", "Currency", "ValidFrom", "ValidTo", "CreatedAt", "UpdatedAt")
            VALUES (@ArticleNumber, @Price, @Currency, @ValidFrom, @ValidTo, NOW(), NOW())
            ON CONFLICT ("ArticleNumber", "Currency", "ValidFrom") DO UPDATE
            SET "Price" = EXCLUDED."Price",
                "ValidTo" = EXCLUDED."ValidTo",
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
                var currency = row.GetValueOrDefault("Currency");

                if (string.IsNullOrWhiteSpace(articleNumber) || string.IsNullOrWhiteSpace(currency))
                {
                    continue;
                }

                if (!decimal.TryParse(row.GetValueOrDefault("Price"), out var price))
                {
                    continue;
                }

                if (!DateTime.TryParse(row.GetValueOrDefault("ValidFrom"), out var validFrom))
                {
                    continue;
                }

                DateTime? validTo = null;
                if (DateTime.TryParse(row.GetValueOrDefault("ValidTo"), out var parsedValidTo))
                {
                    validTo = parsedValidTo;
                }

                await conn.ExecuteAsync(ensureArticleSql, new
                {
                    ArticleNumber = articleNumber
                }, tx);

                await conn.ExecuteAsync(upsertSql, new
                {
                    ArticleNumber = articleNumber,
                    Price = price,
                    Currency = currency,
                    ValidFrom = validFrom,
                    ValidTo = validTo
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
