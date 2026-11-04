namespace Game.Api.Data.Configurations;

using Game.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class GameSessionConfiguration : IEntityTypeConfiguration<GameSession>
{
    public void Configure(EntityTypeBuilder<GameSession> builder)
    {
        builder.ToTable("game_sessions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.LevelId).HasMaxLength(32).IsRequired();
        builder.Property(x => x.ModeCode).HasMaxLength(32).HasDefaultValue("classic");
        builder.Property(x => x.CurrentBoard).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.RulesJson).HasColumnType("jsonb");
        builder.Property(x => x.NotesJson).HasColumnType("jsonb");
        builder.Property(x => x.Version).IsRowVersion();

        // 1. Exactly one InProgress session per user
        builder.HasIndex(x => x.UserId)
            .IsUnique()
            .HasFilter("status = 1");

        // 2. Fast check of unplayed puzzles for user
        builder.HasIndex(x => new { x.UserId, x.PuzzleId });

        // 3. Fast high scores retrieval
        builder.HasIndex(x => new { x.LevelId, x.LayoutType, x.Score, x.ElapsedMs })
            .HasFilter("status = 2");

        builder.HasOne(x => x.Puzzle)
            .WithMany()
            .HasForeignKey(x => x.PuzzleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Moves)
            .WithOne(x => x.Session)
            .HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
