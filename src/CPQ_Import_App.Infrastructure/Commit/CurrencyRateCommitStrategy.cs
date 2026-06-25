using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace CPQ_Import_App.Infrastructure.Commit;

public class CurrencyRateCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.CurrencyRate;

    public async Task CommitRowsAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct = default)
    {
        const string sql = """
            MERGE [dbo].[CpqCurrencyRates] AS target
            USING (SELECT @FromCurrency AS FromCurrency, @ToCurrency AS ToCurrency, @ValidFrom AS ValidFrom) AS source
                ON target.FromCurrency = source.FromCurrency
                AND target.ToCurrency = source.ToCurrency
                AND target.ValidFrom = source.ValidFrom
            WHEN MATCHED THEN
                UPDATE SET Rate = @Rate, UpdatedAt = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (FromCurrency, ToCurrency, Rate, ValidFrom, CreatedAt, UpdatedAt)
                VALUES (@FromCurrency, @ToCurrency, @Rate, @ValidFrom, GETUTCDATE(), GETUTCDATE());
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
                    FromCurrency = row.GetValueOrDefault("FromCurrency"),
                    ToCurrency = row.GetValueOrDefault("ToCurrency"),
                    Rate = row.GetValueOrDefault("Rate"),
                    ValidFrom = row.GetValueOrDefault("ValidFrom")
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
