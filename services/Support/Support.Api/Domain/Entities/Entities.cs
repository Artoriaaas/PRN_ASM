namespace Support.Api.Domain.Entities;

using System;

public sealed class Tutorial
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = "General"; // Technique, Strategy, Rule, Basic
    public string Difficulty { get; set; } = "Easy"; // Easy, Medium, Hard, Expert
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class SystemNotice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = "Notice"; // Update, Event, Maintenance, Notice
    public bool IsPinned { get; set; }
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class FeedbackTicket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = "OTHER"; // BUG, SUGGESTION, REPORT_PLAYER, OTHER
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "NEW"; // NEW, IN_PROGRESS, RESOLVED, CLOSED
    public string? AssignedAdminId { get; set; }
    public string? RelatedMatchId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<FeedbackMessage> Messages { get; set; } = new();
}

public sealed class FeedbackMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TicketId { get; set; }
    public string SenderId { get; set; } = string.Empty;
    public string SenderRole { get; set; } = "USER"; // USER, ADMIN
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public FeedbackTicket? Ticket { get; set; }
}

public sealed class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // FEEDBACK_REPLIED, FEEDBACK_STATUS_CHANGED, ADMIN_ACTION, ANNOUNCEMENT
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? RefId { get; set; }
    public string? SourceEventId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class PlayerRef
{
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class SupportAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ActorId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Before { get; set; } = "{}";
    public string After { get; set; } = "{}";
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
