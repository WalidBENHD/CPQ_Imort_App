using CPQ_Import_App.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ImportJob> ImportJobs => Set<ImportJob>();
    public DbSet<StagingRow> StagingRows => Set<StagingRow>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<UploadedFile> UploadedFiles => Set<UploadedFile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("import");

        modelBuilder.Entity<ImportJob>(e =>
        {
            e.ToTable("ImportJobs");
            e.HasKey(x => x.Id);
            e.Property(x => x.FileName).HasMaxLength(512);
            e.Property(x => x.OriginalFileName).HasMaxLength(512);
            e.Property(x => x.CreatedBy).HasMaxLength(256);
            e.Property(x => x.CreatedByDisplayName).HasMaxLength(512);
            e.Property(x => x.CommittedBy).HasMaxLength(256);
            e.Property(x => x.RejectedBy).HasMaxLength(256);
            e.Property(x => x.RejectionReason).HasMaxLength(2000);
            e.HasMany(x => x.StagingRows).WithOne(x => x.ImportJob).HasForeignKey(x => x.ImportJobId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.AuditLogs).WithOne(x => x.ImportJob).HasForeignKey(x => x.ImportJobId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StagingRow>(e =>
        {
            e.ToTable("StagingRows");
            e.HasKey(x => x.Id);
            e.Property(x => x.RawData).HasColumnType("nvarchar(max)");
            e.Property(x => x.ValidationMessages).HasColumnType("nvarchar(max)");
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.ToTable("AuditLogs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(128);
            e.Property(x => x.PerformedBy).HasMaxLength(256);
            e.Property(x => x.PerformedByDisplayName).HasMaxLength(512);
            e.Property(x => x.Details).HasColumnType("nvarchar(max)");
        });

        modelBuilder.Entity<UploadedFile>(e =>
        {
            e.ToTable("UploadedFiles");
            e.HasKey(x => x.JobId);
            e.Property(x => x.FileName).HasMaxLength(512);
            e.Property(x => x.Content).HasColumnType("varbinary(max)");
        });
    }
}
