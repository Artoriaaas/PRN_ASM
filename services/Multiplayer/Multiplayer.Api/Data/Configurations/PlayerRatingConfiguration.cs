namespace Multiplayer.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Multiplayer.Api.Domain.Entities;

public class PlayerRatingConfiguration : IEntityTypeConfiguration<PlayerRating>
{
    public void Configure(EntityTypeBuilder<PlayerRating> builder)
    {
        builder.ToTable("player_ratings");
        builder.HasKey(x => new { x.UserId, x.PlayFormat });

        builder.Property(x => x.UserId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Version).IsRowVersion();

        builder.HasIndex(x => new { x.PlayFormat, x.Rating, x.MatchesWon });
    }
}
