namespace Multiplayer.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Multiplayer.Api.Domain.Entities;

public class MatchPlayerConfiguration : IEntityTypeConfiguration<MatchPlayer>
{
    public void Configure(EntityTypeBuilder<MatchPlayer> builder)
    {
        builder.ToTable("match_players");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.OpponentUserId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.OpponentName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.LevelId).HasMaxLength(32).IsRequired();
        builder.Property(x => x.CurrentBoard).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.NotesJson).HasColumnType("jsonb");
        builder.Property(x => x.EndReason).HasMaxLength(64);

        builder.HasIndex(x => new { x.MatchId, x.UserId }).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.FinishedAt });
        builder.HasIndex(x => new { x.UserId, x.PlayFormat, x.FinishedAt });
    }
}
