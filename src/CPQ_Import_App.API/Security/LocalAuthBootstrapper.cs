using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CPQ_Import_App.API.Security;

public static class LocalAuthBootstrapper
{
    public static async Task EnsureSeedAdminAsync(AppDbContext db, IConfiguration configuration, CancellationToken ct = default)
    {
        var hasAdmin = await db.TestUsers.AnyAsync(x => x.IsAdmin && x.IsApproved, ct);
        if (hasAdmin)
        {
            return;
        }

        var userName = configuration["Auth:Local:SeedAdmin:UserName"] ?? "admin";
        var displayName = configuration["Auth:Local:SeedAdmin:DisplayName"] ?? "Local Admin";
        var password = configuration["Auth:Local:SeedAdmin:Password"] ?? "Admin123!";

        var normalized = userName.Trim().ToUpperInvariant();
        var existing = await db.TestUsers.FirstOrDefaultAsync(x => x.NormalizedUserName == normalized, ct);

        if (existing is null)
        {
            var (hash, salt) = PasswordHasher.HashPassword(password);
            db.TestUsers.Add(new TestUser
            {
                UserName = userName.Trim(),
                NormalizedUserName = normalized,
                DisplayName = displayName.Trim(),
                PasswordHash = hash,
                PasswordSalt = salt,
                Role = "cpq-approver",
                IsApproved = true,
                IsAdmin = true,
                ApprovedAt = DateTime.UtcNow,
                ApprovedByUserName = "bootstrap"
            });
            await db.SaveChangesAsync(ct);
            return;
        }

        existing.IsApproved = true;
        existing.IsAdmin = true;
        existing.Role = string.IsNullOrWhiteSpace(existing.Role) ? "cpq-approver" : existing.Role;
        existing.ApprovedAt ??= DateTime.UtcNow;
        existing.ApprovedByUserName ??= "bootstrap";
        await db.SaveChangesAsync(ct);
    }
}
