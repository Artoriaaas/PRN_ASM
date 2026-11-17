namespace Game.Api.Domain.Entities;

using System;

public class GameAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ActorFirebaseUid { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string BeforeJson { get; set; } = "{}";
    public string AfterJson { get; set; } = "{}";
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
