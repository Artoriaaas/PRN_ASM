namespace Game.Api.Domain.Entities;

using System;

public class GameMove
{
    public long Id { get; set; }
    public Guid SessionId { get; set; }
    public int MoveOrder { get; set; }
    public int MoveType { get; set; } // 1 = Place, 2 = Hint
    public int Row { get; set; }
    public int Col { get; set; }
    public int Value { get; set; }
    public bool IsCorrect { get; set; }
    public int DifficultyTier { get; set; }
    public int PointsAwarded { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public GameSession? Session { get; set; }
}
