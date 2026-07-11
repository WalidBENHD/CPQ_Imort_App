using Microsoft.Extensions.Configuration;

namespace CPQ_Import_App.Infrastructure.Commit;

public static class CommitConnectionResolver
{
    public static bool ShouldUsePostgres(IConfiguration config)
    {
        var provider = config["Database:Provider"];
        if (string.Equals(provider, "Postgres", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var cpq = config.GetConnectionString("CpqDatabase");
        var import = config.GetConnectionString("ImportDatabase");
        return LooksLikePostgres(import) || LooksLikePostgres(cpq);
    }

    public static string GetPostgresConnectionString(IConfiguration config)
    {
        var raw = config.GetConnectionString("ImportDatabase")
            ?? config.GetConnectionString("CpqDatabase")
            ?? throw new InvalidOperationException("Neither 'ImportDatabase' nor 'CpqDatabase' connection string is configured.");

        return NormalizePostgresConnectionString(raw);
    }

    public static string GetSqlServerConnectionString(IConfiguration config)
        => config.GetConnectionString("CpqDatabase")
            ?? config.GetConnectionString("ImportDatabase")
            ?? throw new InvalidOperationException("Neither 'CpqDatabase' nor 'ImportDatabase' connection string is configured.");

    private static bool LooksLikePostgres(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
            || value.Contains("Host=", StringComparison.OrdinalIgnoreCase)
            || value.Contains("Username=", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizePostgresConnectionString(string raw)
    {
        if (raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            || raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(raw);
            var userInfo = uri.UserInfo.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
            var user = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty;
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
            var database = uri.AbsolutePath.Trim('/');
            var port = uri.IsDefaultPort ? 5432 : uri.Port;

            return $"Host={uri.Host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Require;Trust Server Certificate=true";
        }

        return raw;
    }
}
