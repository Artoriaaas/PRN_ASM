namespace Game.Api.Domain.Entities;

using System;
using System.Collections.Generic;
using System.Text.Json;
using Game.Api.Domain.Exceptions;
using Game.Api.Domain.ValueObjects;
using Sudoku.Core;

public class GameSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;
    public Guid PuzzleId { get; set; }
    public string LevelId { get; set; } = string.Empty;
    public int LayoutType { get; set; } = 1; // 1 = Standard, 2 = Irregular
    public string ModeCode { get; set; } = "classic";
    public string RulesJson { get; set; } = "{}";
    public int Status { get; set; } = 1; // 1 = InProgress, 2 = Completed, 3 = Failed, 4 = Abandoned
    public string CurrentBoard { get; set; } = string.Empty;
    public string NotesJson { get; set; } = "[]";
    public int MistakesCount { get; set; }
    public int HintsUsed { get; set; }
    public int MoveCount { get; set; }
    public int CorrectMoveCount { get; set; }
    public int Score { get; set; }
    public double Accuracy { get; set; }
    public long ElapsedMs { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public uint Version { get; set; } // maps to PostgreSQL xmin

    public Puzzle? Puzzle { get; set; }
    public List<GameMove> Moves { get; set; } = new();

    public SessionRules GetRules()
    {
        try
        {
            return JsonSerializer.Deserialize<SessionRules>(RulesJson) ?? new SessionRules();
        }
        catch
        {
            return new SessionRules();
        }
    }

    public void SetRules(SessionRules rules)
    {
        RulesJson = JsonSerializer.Serialize(rules);
    }

    public GameMove ApplyMove(
        int row,
        int col,
        int value,
        bool isCorrect,
        bool isDuplicateWrong,
        int tier,
        int pointsDelta,
        int maxMistakes)
    {
        EnsureInProgress();

        MoveCount++;
        int idx = CellCoord.ToIndex(row, col);

        if (isCorrect)
        {
            CorrectMoveCount++;
            char[] board = CurrentBoard.ToCharArray();
            board[idx] = (char)('0' + value);
            CurrentBoard = new string(board);

            Score = Math.Max(0, Score + pointsDelta);
            CleanNotesForPlacedDigit(idx, value);

            if (!CurrentBoard.Contains(BoardConstants.EmptyCellChar))
            {
                Status = 2; // Completed
                FinishedAt = DateTime.UtcNow;
            }
        }
        else
        {
            if (!isDuplicateWrong)
            {
                MistakesCount++;
                Score = Math.Max(0, Score + pointsDelta);
            }

            if (MistakesCount >= maxMistakes)
            {
                Status = 3; // Failed
                FinishedAt = DateTime.UtcNow;
            }
        }

        Accuracy = MoveCount > 0 ? (double)CorrectMoveCount / MoveCount : 0.0;
        ElapsedMs = (long)(DateTime.UtcNow - StartedAt).TotalMilliseconds;

        var move = new GameMove
        {
            SessionId = Id,
            MoveOrder = MoveCount,
            MoveType = (int)MoveType.Place,
            Row = row,
            Col = col,
            Value = value,
            IsCorrect = isCorrect,
            DifficultyTier = tier,
            PointsAwarded = pointsDelta,
            CreatedAt = DateTime.UtcNow
        };

        Moves.Add(move);
        return move;
    }

    public GameMove ApplyHint(int row, int col, int value, int tier, int maxHints)
    {
        EnsureInProgress();

        if (HintsUsed >= maxHints)
        {
            throw new InvalidStateException("Maximum hint limit reached for this session.");
        }

        HintsUsed++;
        MoveCount++;
        CorrectMoveCount++;

        int idx = CellCoord.ToIndex(row, col);
        char[] board = CurrentBoard.ToCharArray();
        board[idx] = (char)('0' + value);
        CurrentBoard = new string(board);

        CleanNotesForPlacedDigit(idx, value);

        if (!CurrentBoard.Contains(BoardConstants.EmptyCellChar))
        {
            Status = 2; // Completed
            FinishedAt = DateTime.UtcNow;
        }

        Accuracy = MoveCount > 0 ? (double)CorrectMoveCount / MoveCount : 0.0;
        ElapsedMs = (long)(DateTime.UtcNow - StartedAt).TotalMilliseconds;

        var move = new GameMove
        {
            SessionId = Id,
            MoveOrder = MoveCount,
            MoveType = (int)MoveType.Hint,
            Row = row,
            Col = col,
            Value = value,
            IsCorrect = true,
            DifficultyTier = tier,
            PointsAwarded = 0,
            CreatedAt = DateTime.UtcNow
        };

        Moves.Add(move);
        return move;
    }

    public void Abandon()
    {
        if (Status == 1) // InProgress
        {
            Status = 4; // Abandoned
            FinishedAt = DateTime.UtcNow;
            ElapsedMs = (long)(FinishedAt.Value - StartedAt).TotalMilliseconds;
        }
    }

    public void UpdateNotes(string notesJson)
    {
        EnsureInProgress();
        NotesJson = notesJson;
    }

    private void EnsureInProgress()
    {
        if (Status != 1)
        {
            throw new InvalidStateException($"Session is not in progress (Current status: {Status}).");
        }
    }

    private void CleanNotesForPlacedDigit(int cellIndex, int value)
    {
        // Parse notes, remove notes on cellIndex, and remove value bit (1 << (value - 1)) from peer cells
        if (string.IsNullOrWhiteSpace(NotesJson) || NotesJson == "[]") return;

        try
        {
            var notesDict = JsonSerializer.Deserialize<Dictionary<string, int>>(NotesJson);
            if (notesDict == null) return;

            string key = cellIndex.ToString();
            notesDict.Remove(key);

            int bitToRemove = ~(1 << (value - 1));
            var regionMap = RegionMap.Standard;

            foreach (int peer in regionMap.Peers[cellIndex])
            {
                string peerKey = peer.ToString();
                if (notesDict.TryGetValue(peerKey, out int mask))
                {
                    int newMask = mask & bitToRemove;
                    if (newMask == 0)
                    {
                        notesDict.Remove(peerKey);
                    }
                    else
                    {
                        notesDict[peerKey] = newMask;
                    }
                }
            }

            NotesJson = JsonSerializer.Serialize(notesDict);
        }
        catch
        {
            // If notes format is malformed, reset to empty
            NotesJson = "[]";
        }
    }
}
