namespace Game.Api.Domain.Entities;

public class Level
{
    public string LevelId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int MinClues { get; set; }
    public int MaxClues { get; set; }
    public int MaxMistakes { get; set; } = 3;
    public int MaxHints { get; set; } = 3;
    public bool IsActive { get; set; } = true;
    public double ScoreMultiplier { get; set; } = 1.0;
    public int? TimeLimitSeconds { get; set; }
    public int Version { get; set; } = 1;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
