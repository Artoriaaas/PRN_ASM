namespace Sudoku.Messaging;

using System;

public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EventId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public byte[] Payload { get; set; } = Array.Empty<byte>();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public string? Error { get; set; }
}
