namespace Game.Api.Data.Configurations;

using Game.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class PuzzleConfiguration : IEntityTypeConfiguration<Puzzle>
{
    public void Configure(EntityTypeBuilder<Puzzle> builder)
    {
        builder.ToTable("puzzles");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.LevelId).HasMaxLength(32).IsRequired();
        builder.Property(x => x.InitialBoard).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.SolutionBoard).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.RegionMap).HasMaxLength(81).IsFixedLength().IsRequired();
        builder.Property(x => x.PuzzleHash).HasMaxLength(64).IsRequired();

        builder.HasIndex(x => x.PuzzleHash).IsUnique();
        builder.HasIndex(x => new { x.LevelId, x.LayoutType, x.PlayCount })
            .HasFilter("is_active = true");

        builder.HasOne(x => x.Level)
            .WithMany()
            .HasForeignKey(x => x.LevelId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
