namespace Game.Api.Data.Configurations;

using Game.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class LevelConfiguration : IEntityTypeConfiguration<Level>
{
    public void Configure(EntityTypeBuilder<Level> builder)
    {
        builder.ToTable("levels");
        builder.HasKey(x => x.LevelId);
        builder.Property(x => x.LevelId).HasMaxLength(32);
        builder.Property(x => x.Name).HasMaxLength(64).IsRequired();
    }
}
