namespace Multiplayer.Api.Domain.Entities;

using System;

public class PlayerRating
{
    public const int DefaultInitialRating = 1000;

    public string UserId { get; set; } = string.Empty;
    public int PlayFormat { get; set; } = 1; // 1 = Race, 2 = Duel
    public string DisplayName { get; set; } = string.Empty;
    public int Rating { get; set; } = DefaultInitialRating;
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesDrawn { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public uint Version { get; set; }
}
