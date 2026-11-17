namespace User.Api.Domain.Entities;

using System;

public sealed class EloHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public int Delta { get; set; }
    public int NewElo { get; set; }
    public string SourceType { get; set; } = "ADMIN"; // ADMIN, MATCH, GAME
    public Guid? SourceId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
