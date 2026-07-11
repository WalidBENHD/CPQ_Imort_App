using CPQ_Import_App.API.DTOs;
using CPQ_Import_App.Infrastructure.Commit;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Data.SqlClient;
using Npgsql;
using System.Data.Common;

namespace CPQ_Import_App.API.Controllers;

[ApiController]
[Route("api/admin/maintenance")]
[Authorize(Policy = "AdminOnly")]
public class AdminMaintenanceController(
    AppDbContext db,
    IConfiguration configuration,
    IHostEnvironment hostEnvironment) : ControllerBase
{
    [HttpPost("reset-dev-data")]
    public async Task<ActionResult<DataResetResponseDto>> ResetDevData(CancellationToken ct)
    {
        if (!CanRunReset())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "This reset endpoint is only enabled in development or when Maintenance:AllowDangerousDataReset is true."
            });
        }

        var importTables = new List<string>
        {
            "Notifications",
            "ActivityEvents",
            "UploadedFiles",
            "AuditLogs",
            "StagingRows",
            "ImportJobs"
        };

        var cpqTables = new List<string>
        {
            "CpqArticleDescriptions",
            "CpqArticlePrices",
            "CpqCurrencyRates",
            "CpqArticles"
        };

        await ClearImportDatabaseAsync(ct);
        await ClearCpqDatabaseAsync(ct);

        return Ok(new DataResetResponseDto(
            "Development data has been cleared. TestUsers were preserved.",
            "TestUsers",
            importTables,
            cpqTables));
    }

    private bool CanRunReset()
        => hostEnvironment.IsDevelopment()
           || configuration.GetValue<bool>("Maintenance:AllowDangerousDataReset");

    private async Task ClearImportDatabaseAsync(CancellationToken ct)
    {
        var isPostgres = db.Database.IsNpgsql();
        var statements = isPostgres
            ? new[]
            {
                """DELETE FROM import."Notifications";""",
                """DELETE FROM import."ActivityEvents";""",
                """DELETE FROM import."UploadedFiles";""",
                """DELETE FROM import."AuditLogs";""",
                """DELETE FROM import."StagingRows";""",
                """DELETE FROM import."ImportJobs";"""
            }
            : new[]
            {
                "DELETE FROM [import].[Notifications];",
                "DELETE FROM [import].[ActivityEvents];",
                "DELETE FROM [import].[UploadedFiles];",
                "DELETE FROM [import].[AuditLogs];",
                "DELETE FROM [import].[StagingRows];",
                "DELETE FROM [import].[ImportJobs];"
            };

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            foreach (var statement in statements)
            {
                await db.Database.ExecuteSqlRawAsync(statement, ct);
            }

            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    private async Task ClearCpqDatabaseAsync(CancellationToken ct)
    {
        if (CommitConnectionResolver.ShouldUsePostgres(configuration))
        {
            await ClearCpqPostgresAsync(ct);
            return;
        }

        var connectionString = CommitConnectionResolver.GetSqlServerConnectionString(configuration);
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);

        try
        {
            foreach (var statement in new[]
            {
                "DELETE FROM [dbo].[CpqArticleDescriptions];",
                "DELETE FROM [dbo].[CpqArticlePrices];",
                "DELETE FROM [dbo].[CpqCurrencyRates];",
                "DELETE FROM [dbo].[CpqArticles];"
            })
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = statement;
                await cmd.ExecuteNonQueryAsync(ct);
            }

            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    private async Task ClearCpqPostgresAsync(CancellationToken ct)
    {
        var connectionString = CommitConnectionResolver.GetPostgresConnectionString(configuration);
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        try
        {
            foreach (var statement in new[]
            {
                """DELETE FROM dbo."CpqArticleDescriptions";""",
                """DELETE FROM dbo."CpqArticlePrices";""",
                """DELETE FROM dbo."CpqCurrencyRates";""",
                """DELETE FROM dbo."CpqArticles";"""
            })
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = statement;
                await cmd.ExecuteNonQueryAsync(ct);
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
