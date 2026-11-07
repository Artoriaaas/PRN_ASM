namespace Multiplayer.Api.Domain.Entities;

using System;

public class MatchMove
{
    public long Id { get; set; }
    public Guid MatchId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int TurnNumber { get; set; }
    public int MoveType { get; set; } = 1; // 1 = Place, 2 = Timeout
    public int Row { get; set; }
    public int Col { get; set; }
    public int Value { get; set; }
    public bool IsCorrect { get; set; }
    public int DifficultyTier { get; set; }
    public int PointsAwarded { get; set; }
    public long TimeTakenMs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Match? Match { get; set; }
}
