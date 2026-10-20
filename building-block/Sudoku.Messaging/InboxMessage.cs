namespace Sudoku.Messaging;

using System;

public class InboxMessage
{
    public string EventId { get; set; } = string.Empty;
    public string HandlerName { get; set; } = string.Empty;
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
}
