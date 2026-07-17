using CPQ_Import_App.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ImportJob> ImportJobs => Set<ImportJob>();
    public DbSet<StagingRow> StagingRows => Set<StagingRow>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<UploadedFile> UploadedFiles => Set<UploadedFile>();
    public DbSet<TestUser> TestUsers => Set<TestUser>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ActivityEvent> ActivityEvents => Set<ActivityEvent>();
    public DbSet<EvolisDecryptionRun> EvolisDecryptionRuns => Set<EvolisDecryptionRun>();
    public DbSet<AccessRole> AccessRoles => Set<AccessRole>();
    public DbSet<RoleCapability> RoleCapabilities => Set<RoleCapability>();
    public DbSet<UserAccessRole> UserAccessRoles => Set<UserAccessRole>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var isNpgsql = Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;

        modelBuilder.HasDefaultSchema("import");

        modelBuilder.Entity<ImportJob>(e =>
        {
            e.ToTable("ImportJobs");
            e.HasKey(x => x.Id);
            e.Property(x => x.FileName).HasMaxLength(512);
            e.Property(x => x.OriginalFileName).HasMaxLength(512);
            e.Property(x => x.CreatedBy).HasMaxLength(256);
            e.Property(x => x.CreatedByDisplayName).HasMaxLength(512);
            e.Property(x => x.SubmittedByUserId).HasMaxLength(256);
            e.Property(x => x.SubmittedByDisplayName).HasMaxLength(512);
            e.Property(x => x.SubmittedComparisonJson).HasColumnType(isNpgsql ? "text" : "nvarchar(max)");
            e.Property(x => x.CommittedBy).HasMaxLength(256);
            e.Property(x => x.ApprovedByUserId).HasMaxLength(256);
            e.Property(x => x.ApprovedByDisplayName).HasMaxLength(512);
            e.Property(x => x.RejectedBy).HasMaxLength(256);
            e.Property(x => x.RejectionReason).HasMaxLength(2000);
            e.Property(x => x.ApprovedComparisonJson).HasColumnType(isNpgsql ? "text" : "nvarchar(max)");
            e.HasMany(x => x.StagingRows).WithOne(x => x.ImportJob).HasForeignKey(x => x.ImportJobId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.AuditLogs).WithOne(x => x.ImportJob).HasForeignKey(x => x.ImportJobId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.WorkflowStage, x.CreatedAt });
        });

        modelBuilder.Entity<StagingRow>(e =>
        {
            e.ToTable("StagingRows");
            e.HasKey(x => x.Id);
            e.Property(x => x.RawData).HasColumnType(isNpgsql ? "text" : "nvarchar(max)");
            e.Property(x => x.ValidationMessages).HasColumnType(isNpgsql ? "text" : "nvarchar(max)");
            e.Property(x => x.DeletedByUserId).HasMaxLength(256);
            e.Property(x => x.DeletedByDisplayName).HasMaxLength(512);
            e.HasIndex(x => new { x.ImportJobId, x.IsDeleted, x.RowNumber });
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.ToTable("AuditLogs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(128);
            e.Property(x => x.PerformedBy).HasMaxLength(256);
            e.Property(x => x.PerformedByDisplayName).HasMaxLength(512);
            e.Property(x => x.Details).HasColumnType(isNpgsql ? "text" : "nvarchar(max)");
        });

        modelBuilder.Entity<UploadedFile>(e =>
        {
            e.ToTable("UploadedFiles");
            e.HasKey(x => x.JobId);
            e.Property(x => x.FileName).HasMaxLength(512);
            e.Property(x => x.Content).HasColumnType(isNpgsql ? "bytea" : "varbinary(max)");
            e.HasOne<ImportJob>().WithOne().HasForeignKey<UploadedFile>(x => x.JobId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TestUser>(e =>
        {
            e.ToTable("TestUsers");
            e.HasKey(x => x.Id);
            e.Property(x => x.UserName).HasMaxLength(120);
            e.Property(x => x.NormalizedUserName).HasMaxLength(120);
            e.Property(x => x.DisplayName).HasMaxLength(256);
            e.Property(x => x.PasswordHash).HasMaxLength(512);
            e.Property(x => x.PasswordSalt).HasMaxLength(256);
            e.Property(x => x.Role).HasMaxLength(64);
            e.Property(x => x.ApprovedByUserName).HasMaxLength(120);
            e.HasIndex(x => x.NormalizedUserName).IsUnique();
        });

        modelBuilder.Entity<AccessRole>(e =>
        {
            e.ToTable("AccessRoles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Key).HasMaxLength(80);
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.Icon).HasMaxLength(80);
            e.Property(x => x.Color).HasMaxLength(32);
            e.HasIndex(x => x.Key).IsUnique();
        });

        modelBuilder.Entity<RoleCapability>(e =>
        {
            e.ToTable("RoleCapabilities");
            e.HasKey(x => new { x.RoleId, x.Capability });
            e.Property(x => x.Capability).HasMaxLength(120);
            e.HasOne(x => x.Role).WithMany(x => x.RoleCapabilities).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserAccessRole>(e =>
        {
            e.ToTable("UserAccessRoles");
            e.HasKey(x => new { x.UserId, x.RoleId });
            e.HasOne(x => x.User).WithMany(x => x.AccessRoles).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Role).WithMany(x => x.UserRoles).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.ToTable("Notifications");
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId);
            e.Property(x => x.NotificationType);
            e.Property(x => x.Title).HasMaxLength(256);
            e.Property(x => x.Message).HasColumnType(isNpgsql ? "text" : "nvarchar(max)");
            e.Property(x => x.RelatedUserId);
            e.Property(x => x.RelatedImportId);
            e.Property(x => x.IsRead);
            e.Property(x => x.CreatedAt);
            e.Property(x => x.ExpiresAt);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => new { x.UserId, x.IsRead });
            e.HasIndex(x => x.CreatedAt);
        });

        modelBuilder.Entity<ActivityEvent>(e =>
        {
            e.ToTable("ActivityEvents");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(128);
            e.Property(x => x.Description).HasMaxLength(2000);
            e.Property(x => x.UserId).HasMaxLength(128);
            e.Property(x => x.UserDisplayName).HasMaxLength(256);
            e.Property(x => x.UserRole).HasMaxLength(64);
            e.Property(x => x.TargetType).HasMaxLength(128);
            e.Property(x => x.TargetId).HasMaxLength(128);
            e.Property(x => x.Route).HasMaxLength(1024);
            e.Property(x => x.HttpMethod).HasMaxLength(16);
            e.Property(x => x.IpAddress).HasMaxLength(64);
            e.Property(x => x.UserAgent).HasMaxLength(1024);
            e.Property(x => x.Country).HasMaxLength(128);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.MetadataJson).HasColumnType(isNpgsql ? "text" : "nvarchar(max)");

            e.HasIndex(x => x.OccurredAtUtc);
            e.HasIndex(x => x.Category);
            e.HasIndex(x => x.Action);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => new { x.OccurredAtUtc, x.Category });
        });

        modelBuilder.Entity<EvolisDecryptionRun>(e =>
        {
            e.ToTable("EvolisDecryptionRuns");
            e.HasKey(x => x.Id);
            e.Property(x => x.FileName).HasMaxLength(512);
            e.Property(x => x.FileHash).HasMaxLength(64);
            e.Property(x => x.UserId).HasMaxLength(256);
            e.Property(x => x.UserDisplayName).HasMaxLength(512);
            e.Property(x => x.OutputFormat).HasMaxLength(32);
            e.Property(x => x.FailureReason).HasMaxLength(1000);
            e.HasIndex(x => x.StartedAtUtc);
            e.HasIndex(x => new { x.UserId, x.StartedAtUtc });
            e.HasIndex(x => new { x.Status, x.StartedAtUtc });
        });
    }
}
