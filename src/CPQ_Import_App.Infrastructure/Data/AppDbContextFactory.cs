using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CPQ_Import_App.Infrastructure.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        var provider = Environment.GetEnvironmentVariable("Database__Provider") ?? "SqlServer";
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__ImportDatabase")
            ?? "Server=.;Database=CPQImportDb;Trusted_Connection=true;TrustServerCertificate=true;";

        if (string.Equals(provider, "Postgres", StringComparison.OrdinalIgnoreCase))
        {
            optionsBuilder.UseNpgsql(connectionString);
        }
        else
        {
            optionsBuilder.UseSqlServer(connectionString);
        }

        return new AppDbContext(optionsBuilder.Options);
    }
}
