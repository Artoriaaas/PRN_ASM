namespace User.Api.Data;

using Microsoft.EntityFrameworkCore;
using User.Api.Domain.Entities;

/// <summary>
/// Seed tài khoản admin dev cố định vào user_db nếu chưa tồn tại.
/// Chỉ chạy khi môi trường là Development hoặc biến SEED_ADMIN=true.
/// </summary>
public static class AdminSeeder
{
    /// <summary>Firebase UID cố định cho dev-admin (khớp với DEV_ADMIN_UID ở devAuth.ts)</summary>
    public const string DevAdminUid = "dev-admin-sudoku-fixed-uid-0001";
    public const string DevAdminEmail = "sudokuadmin@gmail.com";
    public const string DevAdminDisplayName = "Sudoku Admin";

    public static async Task SeedAsync(UserDbContext db, IConfiguration config, ILogger logger)
    {
        var shouldSeed = string.Equals(
            config["SeedAdmin"] ?? config["SEED_ADMIN"] ?? "true",
            "true",
            StringComparison.OrdinalIgnoreCase);

        if (!shouldSeed) return;

        var exists = await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.FirebaseUid == DevAdminUid);

        if (exists)
        {
            logger.LogDebug("Dev-admin user already seeded, skipping.");
            return;
        }

        var admin = new UserAccount
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            FirebaseUid = DevAdminUid,
            Email = DevAdminEmail,
            DisplayName = DevAdminDisplayName,
            AvatarUrl = string.Empty,
            Country = "VN",
            Role = "admin",
            Status = "active",
            PlayerLevel = 99,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        db.Users.Add(admin);
        await db.SaveChangesAsync();

        logger.LogInformation(
            "✅ Dev-admin seeded: email={Email}, uid={Uid}",
            DevAdminEmail, DevAdminUid);
    }
}
