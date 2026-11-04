namespace User.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using User.Api.Domain.Entities;

public sealed class UserAccountConfiguration : IEntityTypeConfiguration<UserAccount>
{
    public void Configure(EntityTypeBuilder<UserAccount> builder)
    {
        builder.ToTable("users");
        builder.HasKey(user => user.Id);

        builder.Property(user => user.Id).HasColumnName("id");
        builder.Property(user => user.FirebaseUid).HasColumnName("firebase_uid").HasMaxLength(128).IsRequired();
        builder.Property(user => user.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
        builder.Property(user => user.DisplayName).HasColumnName("display_name").HasMaxLength(80).IsRequired();
        builder.Property(user => user.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(2048).IsRequired();
        builder.Property(user => user.Country).HasColumnName("country").HasMaxLength(80).IsRequired();
        builder.Property(user => user.Role).HasColumnName("role").HasMaxLength(32).IsRequired();
        builder.Property(user => user.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
        builder.Property(user => user.TotalGames).HasColumnName("total_games");
        builder.Property(user => user.Wins).HasColumnName("wins");
        builder.Property(user => user.TotalExp).HasColumnName("total_exp");
        builder.Property(user => user.PlayerLevel).HasColumnName("player_level");
        builder.Property(user => user.Trophies).HasColumnName("trophies");
        builder.Property(user => user.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(user => user.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(user => user.FirebaseUid).IsUnique();
    }
}
