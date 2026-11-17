namespace Game.Api.Domain.Entities;

using System;

public class TaskDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ConditionType { get; set; } = string.Empty;
    public int Target { get; set; }
    public string ProgressSource { get; set; } = "solo"; // solo, multiplayer
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
