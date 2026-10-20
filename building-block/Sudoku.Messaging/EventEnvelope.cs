namespace Sudoku.Messaging;

using System;

public class EventEnvelope
{
    public string EventId { get; set; } = Guid.NewGuid().ToString();
    public string Type { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public string UserId { get; set; } = string.Empty;
    public byte[] Payload { get; set; } = Array.Empty<byte>();
}
