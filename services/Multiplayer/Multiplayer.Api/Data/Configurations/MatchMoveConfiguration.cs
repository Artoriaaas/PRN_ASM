namespace Multiplayer.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Multiplayer.Api.Domain.Entities;

public class MatchMoveConfiguration : IEntityTypeConfiguration<MatchMove>
{
    public void Configure(EntityTypeBuilder<MatchMove> builder)
    {
        builder.ToTable("match_moves");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id).ValueGeneratedOnAdd();
        builder.Property(x => x.UserId).HasMaxLength(128).IsRequired();

        builder.HasIndex(x => new { x.MatchId, x.TurnNumber });
    }
}
