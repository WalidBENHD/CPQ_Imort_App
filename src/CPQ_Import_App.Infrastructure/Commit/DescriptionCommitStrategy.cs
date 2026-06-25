using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace CPQ_Import_App.Infrastructure.Commit;

public class DescriptionCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.Description;

    public async Task CommitRowsAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct = default)
    {
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
}
