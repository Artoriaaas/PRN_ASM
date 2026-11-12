namespace Multiplayer.Api.Domain.Runtime;

using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Threading;
using Multiplayer.Api.Domain.Entities;
using Multiplayer.Api.Domain.ValueObjects;
using Sudoku.Core;

public sealed class ActivePlayerRuntime
{
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int TurnOrder { get; set; } = 1;
    public int RatingBefore { get; set; } = PlayerRating.DefaultInitialRating;
    public string CurrentBoard { get; set; } = string.Empty;
    public Dictionary<int, int> Notes { get; set; } = new();
    public int LivesRemaining { get; set; } = 3;
    public int MistakesCount { get; set; }
    public int CorrectCells { get; set; }
    public int TotalEmptyCells { get; set; }
    public int Score { get; set; }
    public int PenaltySeconds { get; set; }
    public int TimeoutCount { get; set; }
    public HashSet<string> TriedWrongMoves { get; set; } = new(StringComparer.Ordinal);
    public string? ConnectionId { get; set; }
    public DateTime? DisconnectedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    [JsonIgnore]
    public double ProgressPercent =>
        TotalEmptyCells <= 0 ? 100.0 : Math.Round(100.0 * CorrectCells / TotalEmptyCells, 1);

    public bool HasTriedWrongMove(int cellIndex, int value)
        => TriedWrongMoves.Contains($"{cellIndex}:{value}");

    public void RecordWrongMove(int cellIndex, int value)
        => TriedWrongMoves.Add($"{cellIndex}:{value}");

    public void CleanPeerNotes(RegionMap regions, int placedIndex, int digit)
    {
        if (Notes.Count == 0 || !CellCoord.IsValidDigit(digit))
        {
            return;
        }

        int clearBit = ~(1 << (digit - 1));
        Notes.Remove(placedIndex);

        foreach (int peerIdx in regions.Peers[placedIndex])
        {
            if (Notes.TryGetValue(peerIdx, out int mask))
            {
                int updated = mask & clearBit;
                if (updated == 0)
                {
                    Notes.Remove(peerIdx);
                }
                else
                {
                    Notes[peerIdx] = updated;
                }
            }
        }
    }
}

public sealed class ActiveMatchSession
{
    public Guid MatchId { get; set; }
    public int PlayFormat { get; set; } = 1; // 1 = Race, 2 = Duel
    public int BoardLayout { get; set; } = 1; // 1 = Standard, 2 = Irregular
    public string LevelId { get; set; } = "easy";
    public Guid PuzzleId { get; set; }
    public string InitialBoard { get; set; } = string.Empty;
    public string SolutionBoard { get; set; } = string.Empty;
    public string RegionMap { get; set; } = string.Empty;
    public MatchRules Rules { get; set; } = new();
    public string SharedBoard { get; set; } = string.Empty;
    public string CurrentTurnUserId { get; set; } = string.Empty;
    public int TurnNumber { get; set; } = 1;
    public DateTime TurnStartedAtUtc { get; set; }
    public DateTime TurnDeadlineUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime StartedAtUtc { get; set; }
    public DateTime MatchDeadlineUtc { get; set; }
    public bool IsPreparationPhase { get; set; }
    public DateTime PreparationDeadlineUtc { get; set; }
    public bool Player1Ready { get; set; }
    public bool Player2Ready { get; set; }
    public bool IsFinished { get; set; }
    public Dictionary<int, List<int>> RevealedWrongDigits { get; set; } = new();
    public ActivePlayerRuntime Player1 { get; set; } = new();
    public ActivePlayerRuntime Player2 { get; set; } = new();
    public List<MatchMove> MoveHistory { get; set; } = new();

    [JsonIgnore]
    public SemaphoreSlim Gate { get; } = new(1, 1);

    public ActivePlayerRuntime? GetPlayer(string userId)
    {
        if (string.Equals(Player1.UserId, userId, StringComparison.Ordinal)) return Player1;
        if (string.Equals(Player2.UserId, userId, StringComparison.Ordinal)) return Player2;
        return null;
    }

    public ActivePlayerRuntime GetOpponent(string userId)
    {
        return string.Equals(Player1.UserId, userId, StringComparison.Ordinal) ? Player2 : Player1;
    }

    public void AddRevealedWrongDigit(int cellIndex, int value)
    {
        if (!RevealedWrongDigits.TryGetValue(cellIndex, out var list))
        {
            list = new List<int>();
            RevealedWrongDigits[cellIndex] = list;
        }

        if (!list.Contains(value))
        {
            list.Add(value);
        }
    }
}
