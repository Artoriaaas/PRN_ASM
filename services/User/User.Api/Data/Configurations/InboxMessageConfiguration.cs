namespace User.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sudoku.Messaging;

public sealed class InboxMessageConfiguration : IEntityTypeConfiguration<InboxMessage>
{
    public void Configure(EntityTypeBuilder<InboxMessage> builder)
    {
        builder.ToTable("inbox_messages");
        builder.HasKey(x => new { x.EventId, x.HandlerName });

        builder.Property(x => x.EventId).HasColumnName("event_id").HasMaxLength(128).IsRequired();
        builder.Property(x => x.HandlerName).HasColumnName("handler_name").HasMaxLength(128).IsRequired();
        builder.Property(x => x.ReceivedAt).HasColumnName("received_at").IsRequired();
        builder.Property(x => x.ProcessedAt).HasColumnName("processed_at");
    }
}
