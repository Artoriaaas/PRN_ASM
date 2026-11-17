namespace User.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sudoku.Messaging;

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.EventId).HasColumnName("event_id").HasMaxLength(128).IsRequired();
        builder.Property(x => x.Type).HasColumnName("type").HasMaxLength(128).IsRequired();
        builder.Property(x => x.UserId).HasColumnName("user_id").HasMaxLength(128).IsRequired();
        builder.Property(x => x.Topic).HasColumnName("topic").HasMaxLength(128).IsRequired();
        builder.Property(x => x.Payload).HasColumnName("payload").IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(x => x.ProcessedAt).HasColumnName("processed_at");
        builder.Property(x => x.Error).HasColumnName("error");

        builder.HasIndex(x => x.CreatedAt)
            .HasFilter("processed_at IS NULL");
    }
}
