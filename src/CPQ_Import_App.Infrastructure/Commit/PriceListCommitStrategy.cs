using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace CPQ_Import_App.Infrastructure.Commit;

public class PriceListCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.PriceList;

    public async Task CommitRowsAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct = default)
    {
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

        await using var conn = new SqlConnection(config.GetConnectionString("CpqDatabase"));
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
}
