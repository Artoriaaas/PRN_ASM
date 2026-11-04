namespace Game.Api.Domain.Entities;

using System;

public class Puzzle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string LevelId { get; set; } = string.Empty;
    public int LayoutType { get; set; } = 1; // 1 = Standard, 2 = Irregular
    public string InitialBoard { get; set; } = string.Empty;
    public string SolutionBoard { get; set; } = string.Empty;
    public string RegionMap { get; set; } = string.Empty;
    public string PuzzleHash { get; set; } = string.Empty;
    public int ClueCount { get; set; }
    public int DifficultyScore { get; set; }
    public bool IsLogicSolvable { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public int GeneratorVersion { get; set; } = 1;
    public int PlayCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Level? Level { get; set; }
}
