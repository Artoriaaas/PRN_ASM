namespace Support.Api.Data;

using Microsoft.EntityFrameworkCore;
using Support.Api.Domain.Entities;

public sealed class SupportDbContext(DbContextOptions<SupportDbContext> options) : DbContext(options)
{
    public DbSet<Tutorial> Tutorials => Set<Tutorial>();
    public DbSet<SystemNotice> SystemNotices => Set<SystemNotice>();
    public DbSet<FeedbackTicket> FeedbackTickets => Set<FeedbackTicket>();
    public DbSet<FeedbackMessage> FeedbackMessages => Set<FeedbackMessage>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<PlayerRef> PlayerRefs => Set<PlayerRef>();
    public DbSet<SupportAuditLog> SupportAuditLogs => Set<SupportAuditLog>();
    public DbSet<Sudoku.Messaging.InboxMessage> InboxMessages => Set<Sudoku.Messaging.InboxMessage>();
    public DbSet<Sudoku.Messaging.OutboxMessage> OutboxMessages => Set<Sudoku.Messaging.OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("support");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SupportDbContext).Assembly);
    }
}
