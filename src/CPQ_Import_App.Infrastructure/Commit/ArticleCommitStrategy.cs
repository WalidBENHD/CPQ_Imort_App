using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace CPQ_Import_App.Infrastructure.Commit;

/// <summary>
/// Upserts articles into the CPQ [dbo].[CpqArticles] table.
/// MERGE logic: match on ArticleNumber, update Name/Category/Unit, insert if new.
/// </summary>
public class ArticleCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.Article;

    public async Task CommitRowsAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct = default)
    {
        const string sql = """
            MERGE [dbo].[CpqArticles] AS target
            USING (SELECT @ArticleNumber AS ArticleNumber) AS source ON target.ArticleNumber = source.ArticleNumber
            WHEN MATCHED THEN
                UPDATE SET Name = @Name, Category = @Category, Unit = @Unit, UpdatedAt = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ArticleNumber, Name, Category, Unit, CreatedAt, UpdatedAt)
                VALUES (@ArticleNumber, @Name, @Category, @Unit, GETUTCDATE(), GETUTCDATE());
            """;

        await using var conn = new SqlConnection(config.GetConnectionString("CpqDatabase"));
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
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }
}
