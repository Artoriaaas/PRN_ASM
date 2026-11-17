namespace Support.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Support.Api.Domain.Entities;

public sealed class TutorialConfiguration : IEntityTypeConfiguration<Tutorial>
{
    public void Configure(EntityTypeBuilder<Tutorial> builder)
    {
        builder.ToTable("tutorials");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(t => t.Summary).HasColumnName("summary").HasMaxLength(1000).IsRequired();
        builder.Property(t => t.Content).HasColumnName("content").IsRequired();
        builder.Property(t => t.Category).HasColumnName("category").HasMaxLength(64).IsRequired();
        builder.Property(t => t.Difficulty).HasColumnName("difficulty").HasMaxLength(32).IsRequired();
        builder.Property(t => t.SortOrder).HasColumnName("sort_order");
        builder.Property(t => t.IsPublished).HasColumnName("is_published");
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(t => t.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(t => t.SortOrder);
        builder.HasIndex(t => t.Category);
        builder.HasIndex(t => t.Difficulty);
    }
}

public sealed class SystemNoticeConfiguration : IEntityTypeConfiguration<SystemNotice>
{
    public void Configure(EntityTypeBuilder<SystemNotice> builder)
    {
        builder.ToTable("system_notices");
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Id).HasColumnName("id");
        builder.Property(n => n.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(n => n.Content).HasColumnName("content").IsRequired();
        builder.Property(n => n.Category).HasColumnName("category").HasMaxLength(64).IsRequired();
        builder.Property(n => n.IsPinned).HasColumnName("is_pinned");
        builder.Property(n => n.PublishedAt).HasColumnName("published_at").IsRequired();
        builder.Property(n => n.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(n => n.PublishedAt);
        builder.HasIndex(n => n.IsPinned);
    }
}

public sealed class FeedbackTicketConfiguration : IEntityTypeConfiguration<FeedbackTicket>
{
    public void Configure(EntityTypeBuilder<FeedbackTicket> builder)
    {
        builder.ToTable("feedback_tickets");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.UserId).HasColumnName("user_id").HasMaxLength(128).IsRequired();
        builder.Property(t => t.Type).HasColumnName("type").HasMaxLength(32).IsRequired();
        builder.Property(t => t.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
        builder.Property(t => t.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
        builder.Property(t => t.AssignedAdminId).HasColumnName("assigned_admin_id").HasMaxLength(128);
        builder.Property(t => t.RelatedMatchId).HasColumnName("related_match_id").HasMaxLength(128);
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(t => t.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasMany(t => t.Messages)
               .WithOne(m => m.Ticket)
               .HasForeignKey(m => m.TicketId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => new { t.UserId, t.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(t => new { t.Status, t.CreatedAt });
    }
}

public sealed class FeedbackMessageConfiguration : IEntityTypeConfiguration<FeedbackMessage>
{
    public void Configure(EntityTypeBuilder<FeedbackMessage> builder)
    {
        builder.ToTable("feedback_messages");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id).HasColumnName("id");
        builder.Property(m => m.TicketId).HasColumnName("ticket_id").IsRequired();
        builder.Property(m => m.SenderId).HasColumnName("sender_id").HasMaxLength(128).IsRequired();
        builder.Property(m => m.SenderRole).HasColumnName("sender_role").HasMaxLength(16).IsRequired();
        builder.Property(m => m.Content).HasColumnName("content").HasMaxLength(5000).IsRequired();
        builder.Property(m => m.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(m => new { m.TicketId, m.CreatedAt });
    }
}

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Id).HasColumnName("id");
        builder.Property(n => n.UserId).HasColumnName("user_id").HasMaxLength(128).IsRequired();
        builder.Property(n => n.Type).HasColumnName("type").HasMaxLength(64).IsRequired();
        builder.Property(n => n.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(n => n.Body).HasColumnName("body").IsRequired();
        builder.Property(n => n.RefId).HasColumnName("ref_id").HasMaxLength(128);
        builder.Property(n => n.SourceEventId).HasColumnName("source_event_id").HasMaxLength(128);
        builder.Property(n => n.IsRead).HasColumnName("is_read");
        builder.Property(n => n.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(n => new { n.UserId, n.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(n => new { n.UserId, n.SourceEventId })
               .IsUnique()
               .HasFilter("source_event_id IS NOT NULL AND source_event_id <> ''");
    }
}

public sealed class PlayerRefConfiguration : IEntityTypeConfiguration<PlayerRef>
{
    public void Configure(EntityTypeBuilder<PlayerRef> builder)
    {
        builder.ToTable("player_refs");
        builder.HasKey(p => p.UserId);

        builder.Property(p => p.UserId).HasColumnName("user_id").HasMaxLength(128).IsRequired();
        builder.Property(p => p.DisplayName).HasColumnName("display_name").HasMaxLength(80).IsRequired();
        builder.Property(p => p.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }
}

public sealed class SupportAuditLogConfiguration : IEntityTypeConfiguration<SupportAuditLog>
{
    public void Configure(EntityTypeBuilder<SupportAuditLog> builder)
    {
        builder.ToTable("support_audit_logs");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id).HasColumnName("id");
        builder.Property(l => l.ActorId).HasColumnName("actor_id").HasMaxLength(128).IsRequired();
        builder.Property(l => l.Action).HasColumnName("action").HasMaxLength(64).IsRequired();
        builder.Property(l => l.TargetType).HasColumnName("target_type").HasMaxLength(64).IsRequired();
        builder.Property(l => l.TargetId).HasColumnName("target_id").HasMaxLength(128).IsRequired();
        builder.Property(l => l.Before).HasColumnName("before").HasColumnType("jsonb").IsRequired();
        builder.Property(l => l.After).HasColumnName("after").HasColumnType("jsonb").IsRequired();
        builder.Property(l => l.Reason).HasColumnName("reason").IsRequired();
        builder.Property(l => l.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(l => l.CreatedAt).IsDescending();
    }
}

public sealed class InboxMessageConfiguration : IEntityTypeConfiguration<Sudoku.Messaging.InboxMessage>
{
    public void Configure(EntityTypeBuilder<Sudoku.Messaging.InboxMessage> builder)
    {
        builder.ToTable("inbox_messages");
        builder.HasKey(x => new { x.EventId, x.HandlerName });

        builder.Property(x => x.EventId).HasColumnName("event_id").HasMaxLength(128).IsRequired();
        builder.Property(x => x.HandlerName).HasColumnName("handler_name").HasMaxLength(128).IsRequired();
        builder.Property(x => x.ReceivedAt).HasColumnName("received_at").IsRequired();
        builder.Property(x => x.ProcessedAt).HasColumnName("processed_at");
    }
}

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<Sudoku.Messaging.OutboxMessage>
{
    public void Configure(EntityTypeBuilder<Sudoku.Messaging.OutboxMessage> builder)
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

        builder.HasIndex(x => x.CreatedAt).HasFilter("processed_at IS NULL");
    }
}
