namespace Multiplayer.Api.Domain.Entities;

using System;

public class MatchPlayer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MatchId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string OpponentUserId { get; set; } = string.Empty;
    public string OpponentName { get; set; } = string.Empty;
    public int OpponentScore { get; set; }
    public int PlayFormat { get; set; } = 1;
    public int BoardLayout { get; set; } = 1;
    public string LevelId { get; set; } = "easy";
    public int TurnOrder { get; set; } = 1;
    public string CurrentBoard { get; set; } = string.Empty;
    public string NotesJson { get; set; } = "{}";
    public int LivesRemaining { get; set; } = 3;
    public int MistakesCount { get; set; }
    public int CorrectCells { get; set; }
    public int Score { get; set; }
    public int PenaltySeconds { get; set; }
    public int TimeoutCount { get; set; }
    public int Result { get; set; } // 0 = Unspecified, 1 = Win, 2 = Loss, 3 = Draw
    public string EndReason { get; set; } = string.Empty;
    public long CompletionMs { get; set; }
    public int RatingBefore { get; set; } = 1000;
    public int RatingDelta { get; set; }
    public DateTime? FinishedAt { get; set; }

    public Match? Match { get; set; }
}
