namespace User.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using User.Api.Domain.Entities;

public sealed class EloHistoryConfiguration : IEntityTypeConfiguration<EloHistory>
{
    public void Configure(EntityTypeBuilder<EloHistory> builder)
    {
        builder.ToTable("elo_history");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(e => e.Delta).HasColumnName("delta").IsRequired();
        builder.Property(e => e.NewElo).HasColumnName("new_elo").IsRequired();
        builder.Property(e => e.SourceType).HasColumnName("source_type").HasMaxLength(32).IsRequired();
        builder.Property(e => e.SourceId).HasColumnName("source_id");
        builder.Property(e => e.Reason).HasColumnName("reason").IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(e => new { e.UserId, e.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(e => new { e.UserId, e.SourceType, e.SourceId })
               .IsUnique()
               .HasFilter("source_id IS NOT NULL");
    }
}
