namespace Multiplayer.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sudoku.Messaging;

public class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.EventId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Type).HasMaxLength(128).IsRequired();
        builder.Property(x => x.UserId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Topic).HasMaxLength(128).IsRequired();

        builder.HasIndex(x => x.CreatedAt)
            .HasFilter("processed_at IS NULL");
    }
}

public class InboxMessageConfiguration : IEntityTypeConfiguration<InboxMessage>
{
    public void Configure(EntityTypeBuilder<InboxMessage> builder)
    {
        builder.ToTable("inbox_messages");
        builder.HasKey(x => new { x.EventId, x.HandlerName });

        builder.Property(x => x.EventId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.HandlerName).HasMaxLength(128).IsRequired();
    }
}
