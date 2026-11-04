namespace Game.Api.Data.Configurations;

using Game.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class GameMoveConfiguration : IEntityTypeConfiguration<GameMove>
{
    public void Configure(EntityTypeBuilder<GameMove> builder)
    {
        builder.ToTable("game_moves");
        builder.HasKey(x => x.Id);

        builder.HasIndex(x => new { x.SessionId, x.MoveOrder })
            .IsUnique();

        builder.HasIndex(x => new { x.SessionId, x.Row, x.Col, x.Value })
            .HasFilter("is_correct = false");
    }
}
