using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Interfaces;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace CPQ_Import_App.Infrastructure.Commit;

public class CurrencyRateCommitStrategy(IConfiguration config) : ICpqCommitStrategy
{
    public EntityType EntityType => EntityType.CurrencyRate;

    public async Task CommitRowsAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct = default)
    {
        if (UsePostgres())
        {
            await CommitRowsPostgresAsync(rows, ct);
            return;
        }

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

        await using var conn = new SqlConnection(GetCpqConnectionString());
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

    private async Task CommitRowsPostgresAsync(IEnumerable<Dictionary<string, string?>> rows, CancellationToken ct)
    {
        const string ensureSql = """
            CREATE SCHEMA IF NOT EXISTS dbo;
            CREATE TABLE IF NOT EXISTS dbo."CpqCurrencyRates" (
                "FromCurrency" text NOT NULL,
                "ToCurrency" text NOT NULL,
                "Rate" numeric(18,6) NOT NULL,
                "ValidFrom" timestamp with time zone NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_CpqCurrencyRates" PRIMARY KEY ("FromCurrency", "ToCurrency", "ValidFrom")
            );
            """;

        const string upsertSql = """
            INSERT INTO dbo."CpqCurrencyRates" ("FromCurrency", "ToCurrency", "Rate", "ValidFrom", "CreatedAt", "UpdatedAt")
            VALUES (@FromCurrency, @ToCurrency, @Rate, @ValidFrom, NOW(), NOW())
            ON CONFLICT ("FromCurrency", "ToCurrency", "ValidFrom") DO UPDATE
            SET "Rate" = EXCLUDED."Rate",
                "UpdatedAt" = NOW();
            """;

        await using var conn = new NpgsqlConnection(GetCpqConnectionString());
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        try
        {
            await conn.ExecuteAsync(ensureSql, transaction: tx);

            foreach (var row in rows)
            {
                ct.ThrowIfCancellationRequested();

                var fromCurrency = row.GetValueOrDefault("FromCurrency");
                var toCurrency = row.GetValueOrDefault("ToCurrency");

                if (string.IsNullOrWhiteSpace(fromCurrency) || string.IsNullOrWhiteSpace(toCurrency))
                {
                    continue;
                }

                if (!decimal.TryParse(row.GetValueOrDefault("Rate"), out var rate))
                {
                    continue;
                }

                if (!DateTime.TryParse(row.GetValueOrDefault("ValidFrom"), out var validFrom))
                {
                    continue;
                }

                await conn.ExecuteAsync(upsertSql, new
                {
                    FromCurrency = fromCurrency,
                    ToCurrency = toCurrency,
                    Rate = rate,
                    ValidFrom = validFrom
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

    private bool UsePostgres()
        => string.Equals(config["Database:Provider"], "Postgres", StringComparison.OrdinalIgnoreCase);

    private string GetCpqConnectionString()
    {
        if (UsePostgres())
        {
            return config.GetConnectionString("ImportDatabase")
                ?? throw new InvalidOperationException("'ImportDatabase' connection string is required for Postgres commit mode.");
        }

        return config.GetConnectionString("CpqDatabase")
            ?? config.GetConnectionString("ImportDatabase")
            ?? throw new InvalidOperationException("Neither 'CpqDatabase' nor 'ImportDatabase' connection string is configured.");
    }
}
