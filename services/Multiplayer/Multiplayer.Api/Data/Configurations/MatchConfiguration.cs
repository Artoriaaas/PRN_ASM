namespace Multiplayer.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Multiplayer.Api.Domain.Entities;

public class MatchConfiguration : IEntityTypeConfiguration<Match>
{
    public void Configure(EntityTypeBuilder<Match> builder)
    {
        builder.ToTable("matches");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.LevelId).HasMaxLength(32).IsRequired();
        builder.Property(x => x.InitialBoard).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.SolutionBoard).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.RegionMap).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.SharedBoard).HasMaxLength(81).IsRequired();
        builder.Property(x => x.RulesJson).HasColumnType("jsonb");
        builder.Property(x => x.CurrentTurnUserId).HasMaxLength(128);
        builder.Property(x => x.WinnerUserId).HasMaxLength(128);
        builder.Property(x => x.EndReason).HasMaxLength(64);
        builder.Property(x => x.Version).IsRowVersion();

        builder.HasIndex(x => new { x.Status, x.StartedAt });
        builder.HasIndex(x => new { x.TournamentId, x.RoundNumber, x.BracketSlot });

        builder.HasMany(x => x.Players)
            .WithOne(x => x.Match)
            .HasForeignKey(x => x.MatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Moves)
            .WithOne(x => x.Match)
            .HasForeignKey(x => x.MatchId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
