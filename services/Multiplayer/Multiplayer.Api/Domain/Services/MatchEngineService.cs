namespace Multiplayer.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Multiplayer.Api.Domain.Entities;
using Multiplayer.Api.Domain.Exceptions;
using Multiplayer.Api.Domain.Runtime;
using Sudoku.Core;
using Sudoku.Multi.V1;

public sealed record MoveExecutionOutcome(
    Guid MatchId,
    string UserId,
    int CellIndex,
    int Value,
    bool IsCorrect,
    bool IsDuplicateWrong,
    int DifficultyTier,
    int PointsDelta,
    int LivesRemaining,
    int MistakesCount,
    int PenaltySeconds,
    int Score,
    int CorrectCells,
    double ProgressPercent,
    bool TurnChanged,
    string CurrentTurnUserId,
    int TurnNumber,
    DateTime TurnDeadlineUtc,
    IReadOnlyList<int> RevealedWrongDigitsAtCell,
    bool MatchEnded,
    FinalizedMatchSummary? FinalSummary
);

public sealed record TurnTimeoutOutcome(
    Guid MatchId,
    string TimedOutUserId,
    int LivesRemaining,
    int TimeoutCount,
    string NextTurnUserId,
    int NextTurnNumber,
    DateTime NextTurnDeadlineUtc,
    bool MatchEnded,
    FinalizedMatchSummary? FinalSummary
);

public interface IMatchEngineService
{
    Task<MoveExecutionOutcome> SubmitMoveAsync(
        Guid matchId,
        string userId,
        int cellIndex,
        int value,
        int turnNumber,
        CancellationToken ct = default);

    Task SaveNotesAsync(
        Guid matchId,
        string userId,
        Dictionary<int, int> notes,
        CancellationToken ct = default);

    Task<FinalizedMatchSummary> ResignAsync(
        Guid matchId,
        string userId,
        CancellationToken ct = default);

    Task<TurnTimeoutOutcome?> CheckAndApplyDuelTurnTimeoutAsync(
        ActiveMatchSession session,
        DateTime nowUtc,
        CancellationToken ct = default);

    Task<FinalizedMatchSummary?> CheckAndApplyLifecycleExpirationsAsync(
        ActiveMatchSession session,
        DateTime nowUtc,
        CancellationToken ct = default);
}

public sealed class MatchEngineService : IMatchEngineService
{
    private readonly IMatchRuntimeStore _runtimeStore;
    private readonly IMatchFinalizerService _finalizer;

    public MatchEngineService(
        IMatchRuntimeStore runtimeStore,
        IMatchFinalizerService finalizer)
    {
        _runtimeStore = runtimeStore;
        _finalizer = finalizer;
    }

    public async Task<MoveExecutionOutcome> SubmitMoveAsync(
        Guid matchId,
        string userId,
        int cellIndex,
        int value,
        int turnNumber,
        CancellationToken ct = default)
    {
        if (!CellCoord.IsValidIndex(cellIndex))
        {
            throw new ValidationException($"Cell index {cellIndex} is out of bounds (0..80).");
        }

        if (!CellCoord.IsValidDigitOrEmpty(value))
        {
            throw new ValidationException($"Value {value} must be between 0 and 9.");
        }

        var session = await _runtimeStore.GetAsync(matchId, ct)
            ?? throw new NotFoundException($"Active match '{matchId}' was not found.");

        await session.Gate.WaitAsync(ct);
        try
        {
            if (session.IsFinished)
            {
                throw new InvalidStateException("Match has already ended.");
            }

            var player = session.GetPlayer(userId)
                ?? throw new ValidationException("Caller is not a participant in this match.");
            var opponent = session.GetOpponent(userId);

            if (value == 0)
            {
                throw new ValidationException("Placed cells are validated immediately by the server and cannot be cleared.");
            }

            return session.PlayFormat == (int)PlayFormat.Duel
                ? await ExecuteDuelMoveCoreAsync(session, player, opponent, cellIndex, value, turnNumber, ct)
                : await ExecuteRaceMoveCoreAsync(session, player, opponent, cellIndex, value, ct);
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task SaveNotesAsync(
        Guid matchId,
        string userId,
        Dictionary<int, int> notes,
        CancellationToken ct = default)
    {
        var session = await _runtimeStore.GetAsync(matchId, ct)
            ?? throw new NotFoundException($"Active match '{matchId}' was not found.");

        await session.Gate.WaitAsync(ct);
        try
        {
            if (session.IsFinished)
            {
                return;
            }

            var player = session.GetPlayer(userId)
                ?? throw new ValidationException("Caller is not a participant in this match.");

            player.Notes.Clear();
            foreach (var (cellIdx, mask) in notes)
            {
                if (CellCoord.IsValidIndex(cellIdx) && mask > 0 && mask <= 0x1FF)
                {
                    player.Notes[cellIdx] = mask;
                }
            }

            await _runtimeStore.SaveAsync(session, ct);
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task<FinalizedMatchSummary> ResignAsync(
        Guid matchId,
        string userId,
        CancellationToken ct = default)
    {
        var session = await _runtimeStore.GetAsync(matchId, ct)
            ?? throw new NotFoundException($"Active match '{matchId}' was not found.");

        await session.Gate.WaitAsync(ct);
        try
        {
            if (session.IsFinished)
            {
                throw new InvalidStateException("Match has already ended.");
            }

            var player = session.GetPlayer(userId)
                ?? throw new ValidationException("Caller is not a participant in this match.");
            var opponent = session.GetOpponent(userId);

            return await _finalizer.FinalizeMatchAsync(
                session,
                winnerUserId: opponent.UserId,
                isDraw: false,
                endReason: "resigned",
                ct);
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task<TurnTimeoutOutcome?> CheckAndApplyDuelTurnTimeoutAsync(
        ActiveMatchSession session,
        DateTime nowUtc,
        CancellationToken ct = default)
    {
        if (session.PlayFormat != (int)PlayFormat.Duel || session.IsFinished)
        {
            return null;
        }

        await session.Gate.WaitAsync(ct);
        try
        {
            if (session.IsFinished || nowUtc <= session.TurnDeadlineUtc.AddMilliseconds(session.Rules.TurnGraceMs))
            {
                return null;
            }

            var currentPlayer = session.GetPlayer(session.CurrentTurnUserId) ?? session.Player1;
            var opponent = session.GetOpponent(currentPlayer.UserId);

            currentPlayer.TimeoutCount++;
            currentPlayer.LivesRemaining = Math.Max(0, currentPlayer.LivesRemaining - 1);

            session.MoveHistory.Add(new MatchMove
            {
                MatchId = session.MatchId,
                UserId = currentPlayer.UserId,
                TurnNumber = session.TurnNumber,
                MoveType = 2, // Timeout
                Row = 0,
                Col = 0,
                Value = 0,
                IsCorrect = false,
                DifficultyTier = 0,
                PointsAwarded = 0,
                TimeTakenMs = (long)Math.Max(0, (nowUtc - session.TurnStartedAtUtc).TotalMilliseconds),
                CreatedAt = nowUtc
            });

            if (currentPlayer.LivesRemaining <= 0)
            {
                var summary = await _finalizer.FinalizeMatchAsync(
                    session,
                    winnerUserId: opponent.UserId,
                    isDraw: false,
                    endReason: "opponent_out_of_lives",
                    ct);

                return new TurnTimeoutOutcome(
                    MatchId: session.MatchId,
                    TimedOutUserId: currentPlayer.UserId,
                    LivesRemaining: 0,
                    TimeoutCount: currentPlayer.TimeoutCount,
                    NextTurnUserId: opponent.UserId,
                    NextTurnNumber: session.TurnNumber,
                    NextTurnDeadlineUtc: nowUtc,
                    MatchEnded: true,
                    FinalSummary: summary
                );
            }

            session.TurnNumber++;
            session.CurrentTurnUserId = opponent.UserId;
            session.TurnStartedAtUtc = nowUtc;
            session.TurnDeadlineUtc = nowUtc.AddSeconds(session.Rules.TurnSeconds);

            await _runtimeStore.SaveAsync(session, ct);

            return new TurnTimeoutOutcome(
                MatchId: session.MatchId,
                TimedOutUserId: currentPlayer.UserId,
                LivesRemaining: currentPlayer.LivesRemaining,
                TimeoutCount: currentPlayer.TimeoutCount,
                NextTurnUserId: session.CurrentTurnUserId,
                NextTurnNumber: session.TurnNumber,
                NextTurnDeadlineUtc: session.TurnDeadlineUtc,
                MatchEnded: false,
                FinalSummary: null
            );
        }
        finally
        {
            session.Gate.Release();
        }
    }

    public async Task<FinalizedMatchSummary?> CheckAndApplyLifecycleExpirationsAsync(
        ActiveMatchSession session,
        DateTime nowUtc,
        CancellationToken ct = default)
    {
        if (session.IsFinished)
        {
            return null;
        }

        await session.Gate.WaitAsync(ct);
        try
        {
            if (session.IsFinished)
            {
                return null;
            }

            // 1. Check 30s disconnect timeout
            bool p1Expired = session.Player1.DisconnectedAtUtc.HasValue &&
                             (nowUtc - session.Player1.DisconnectedAtUtc.Value).TotalSeconds >= session.Rules.ReconnectGraceSeconds;
            bool p2Expired = session.Player2.DisconnectedAtUtc.HasValue &&
                             (nowUtc - session.Player2.DisconnectedAtUtc.Value).TotalSeconds >= session.Rules.ReconnectGraceSeconds;

            if (p1Expired && p2Expired)
            {
                return await _finalizer.FinalizeMatchAsync(session, null, isDraw: true, "disconnect_timeout", ct);
            }
            if (p1Expired)
            {
                return await _finalizer.FinalizeMatchAsync(session, session.Player2.UserId, isDraw: false, "disconnect_timeout", ct);
            }
            if (p2Expired)
            {
                return await _finalizer.FinalizeMatchAsync(session, session.Player1.UserId, isDraw: false, "disconnect_timeout", ct);
            }

            // 2. Check match overall time limit
            if (nowUtc >= session.MatchDeadlineUtc)
            {
                var (winnerId, isDraw) = ResolveTimeLimitWinner(session);
                return await _finalizer.FinalizeMatchAsync(session, winnerId, isDraw, "time_limit", ct);
            }

            return null;
        }
        finally
        {
            session.Gate.Release();
        }
    }

    private async Task<MoveExecutionOutcome> ExecuteRaceMoveCoreAsync(
        ActiveMatchSession session,
        ActivePlayerRuntime player,
        ActivePlayerRuntime opponent,
        int cellIndex,
        int value,
        CancellationToken ct)
    {
        int row = CellCoord.ToRow(cellIndex);
        int col = CellCoord.ToCol(cellIndex);
        var regions = new RegionMap(session.RegionMap);
        bool isDuplicateWrong = player.HasTriedWrongMove(cellIndex, value);
        var now = DateTime.UtcNow;

        var eval = MoveEvaluator.Evaluate(
            session.InitialBoard,
            player.CurrentBoard,
            session.SolutionBoard,
            regions,
            row,
            col,
            value,
            isDuplicateWrong
        );

        if (!eval.IsAllowed)
        {
            throw new ValidationException(eval.FailureReason ?? "Move is not allowed.");
        }

        int moveSeq = session.MoveHistory.Count + 1;
        session.MoveHistory.Add(new MatchMove
        {
            MatchId = session.MatchId,
            UserId = player.UserId,
            TurnNumber = moveSeq,
            MoveType = 1,
            Row = row,
            Col = col,
            Value = value,
            IsCorrect = eval.IsCorrect,
            DifficultyTier = (int)eval.Tier,
            PointsAwarded = eval.PointsDelta,
            TimeTakenMs = (long)Math.Max(0, (now - session.StartedAtUtc).TotalMilliseconds),
            CreatedAt = now
        });

        FinalizedMatchSummary? finalSummary = null;
        bool matchEnded = false;

        if (eval.IsCorrect)
        {
            char[] chars = player.CurrentBoard.ToCharArray();
            chars[cellIndex] = (char)('0' + value);
            player.CurrentBoard = new string(chars);

            player.CorrectCells++;
            player.Score += eval.PointsDelta;
            player.CleanPeerNotes(regions, cellIndex, value);

            if (player.CorrectCells >= player.TotalEmptyCells || !player.CurrentBoard.Contains(BoardConstants.EmptyCellChar))
            {
                player.CompletedAtUtc = now;
                matchEnded = true;
                finalSummary = await _finalizer.FinalizeMatchAsync(
                    session,
                    winnerUserId: player.UserId,
                    isDraw: false,
                    endReason: "completed",
                    ct);
            }
        }
        else
        {
            if (!eval.IsDuplicateWrong)
            {
                player.RecordWrongMove(cellIndex, value);
                player.MistakesCount++;
                player.LivesRemaining = Math.Max(0, player.LivesRemaining - 1);
                player.PenaltySeconds += session.Rules.WrongTimePenaltySeconds;
                player.Score = Math.Max(0, player.Score + eval.PointsDelta);
            }

            if (player.LivesRemaining <= 0)
            {
                matchEnded = true;
                finalSummary = await _finalizer.FinalizeMatchAsync(
                    session,
                    winnerUserId: opponent.UserId,
                    isDraw: false,
                    endReason: "opponent_out_of_lives",
                    ct);
            }
        }

        if (!matchEnded)
        {
            await _runtimeStore.SaveAsync(session, ct);
        }

        return new MoveExecutionOutcome(
            MatchId: session.MatchId,
            UserId: player.UserId,
            CellIndex: cellIndex,
            Value: value,
            IsCorrect: eval.IsCorrect,
            IsDuplicateWrong: eval.IsDuplicateWrong,
            DifficultyTier: (int)eval.Tier,
            PointsDelta: eval.PointsDelta,
            LivesRemaining: player.LivesRemaining,
            MistakesCount: player.MistakesCount,
            PenaltySeconds: player.PenaltySeconds,
            Score: player.Score,
            CorrectCells: player.CorrectCells,
            ProgressPercent: player.ProgressPercent,
            TurnChanged: false,
            CurrentTurnUserId: string.Empty,
            TurnNumber: moveSeq,
            TurnDeadlineUtc: session.MatchDeadlineUtc,
            RevealedWrongDigitsAtCell: Array.Empty<int>(),
            MatchEnded: matchEnded,
            FinalSummary: finalSummary
        );
    }

    private async Task<MoveExecutionOutcome> ExecuteDuelMoveCoreAsync(
        ActiveMatchSession session,
        ActivePlayerRuntime player,
        ActivePlayerRuntime opponent,
        int cellIndex,
        int value,
        int turnNumber,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        if (!string.Equals(session.CurrentTurnUserId, player.UserId, StringComparison.Ordinal))
        {
            throw new InvalidStateException("It is currently your opponent's turn.");
        }

        if (turnNumber > 0 && turnNumber != session.TurnNumber)
        {
            throw new InvalidStateException($"Stale turn number {turnNumber} (current turn is {session.TurnNumber}).");
        }

        if (now > session.TurnDeadlineUtc.AddMilliseconds(session.Rules.TurnGraceMs))
        {
            throw new InvalidStateException("Turn time limit has expired.");
        }

        int row = CellCoord.ToRow(cellIndex);
        int col = CellCoord.ToCol(cellIndex);
        var regions = new RegionMap(session.RegionMap);

        bool alreadyRevealedWrong = session.RevealedWrongDigits.TryGetValue(cellIndex, out var wrongList) &&
                                    wrongList.Contains(value);
        bool isDuplicateWrong = alreadyRevealedWrong || player.HasTriedWrongMove(cellIndex, value);

        var eval = MoveEvaluator.Evaluate(
            session.InitialBoard,
            session.SharedBoard,
            session.SolutionBoard,
            regions,
            row,
            col,
            value,
            isDuplicateWrong
        );

        if (!eval.IsAllowed)
        {
            throw new ValidationException(eval.FailureReason ?? "Move is not allowed.");
        }

        int executedTurn = session.TurnNumber;
        session.MoveHistory.Add(new MatchMove
        {
            MatchId = session.MatchId,
            UserId = player.UserId,
            TurnNumber = executedTurn,
            MoveType = 1,
            Row = row,
            Col = col,
            Value = value,
            IsCorrect = eval.IsCorrect,
            DifficultyTier = (int)eval.Tier,
            PointsAwarded = eval.PointsDelta,
            TimeTakenMs = (long)Math.Max(0, (now - session.TurnStartedAtUtc).TotalMilliseconds),
            CreatedAt = now
        });

        FinalizedMatchSummary? finalSummary = null;
        bool matchEnded = false;

        if (eval.IsCorrect)
        {
            char[] chars = session.SharedBoard.ToCharArray();
            chars[cellIndex] = (char)('0' + value);
            session.SharedBoard = new string(chars);

            player.CorrectCells++;
            player.Score += eval.PointsDelta;
            session.RevealedWrongDigits.Remove(cellIndex);
            session.Player1.CleanPeerNotes(regions, cellIndex, value);
            session.Player2.CleanPeerNotes(regions, cellIndex, value);

            if (!session.SharedBoard.Contains(BoardConstants.EmptyCellChar))
            {
                matchEnded = true;
                var (winnerId, isDraw) = ResolveDuelCompletedWinner(session);
                finalSummary = await _finalizer.FinalizeMatchAsync(
                    session,
                    winnerId,
                    isDraw,
                    endReason: isDraw ? "draw" : "completed",
                    ct);
            }
        }
        else
        {
            if (!eval.IsDuplicateWrong)
            {
                player.RecordWrongMove(cellIndex, value);
                player.MistakesCount++;
                player.LivesRemaining = Math.Max(0, player.LivesRemaining - 1);
                player.Score = Math.Max(0, player.Score + eval.PointsDelta);
                session.AddRevealedWrongDigit(cellIndex, value);
            }

            if (player.LivesRemaining <= 0)
            {
                matchEnded = true;
                finalSummary = await _finalizer.FinalizeMatchAsync(
                    session,
                    winnerUserId: opponent.UserId,
                    isDraw: false,
                    endReason: "opponent_out_of_lives",
                    ct);
            }
        }

        if (!matchEnded)
        {
            session.TurnNumber++;
            session.CurrentTurnUserId = opponent.UserId;
            session.TurnStartedAtUtc = now;
            session.TurnDeadlineUtc = now.AddSeconds(session.Rules.TurnSeconds);

            await _runtimeStore.SaveAsync(session, ct);
        }

        IReadOnlyList<int> revealedAtCell = session.RevealedWrongDigits.TryGetValue(cellIndex, out var list)
            ? list.ToArray()
            : Array.Empty<int>();

        return new MoveExecutionOutcome(
            MatchId: session.MatchId,
            UserId: player.UserId,
            CellIndex: cellIndex,
            Value: value,
            IsCorrect: eval.IsCorrect,
            IsDuplicateWrong: eval.IsDuplicateWrong,
            DifficultyTier: (int)eval.Tier,
            PointsDelta: eval.PointsDelta,
            LivesRemaining: player.LivesRemaining,
            MistakesCount: player.MistakesCount,
            PenaltySeconds: player.PenaltySeconds,
            Score: player.Score,
            CorrectCells: player.CorrectCells,
            ProgressPercent: player.ProgressPercent,
            TurnChanged: !matchEnded,
            CurrentTurnUserId: session.CurrentTurnUserId,
            TurnNumber: session.TurnNumber,
            TurnDeadlineUtc: session.TurnDeadlineUtc,
            RevealedWrongDigitsAtCell: revealedAtCell,
            MatchEnded: matchEnded,
            FinalSummary: finalSummary
        );
    }

    private static (string? WinnerUserId, bool IsDraw) ResolveDuelCompletedWinner(ActiveMatchSession session)
    {
        if (session.Player1.Score != session.Player2.Score)
        {
            return session.Player1.Score > session.Player2.Score
                ? (session.Player1.UserId, false)
                : (session.Player2.UserId, false);
        }

        if (session.Player1.LivesRemaining != session.Player2.LivesRemaining)
        {
            return session.Player1.LivesRemaining > session.Player2.LivesRemaining
                ? (session.Player1.UserId, false)
                : (session.Player2.UserId, false);
        }

        return (null, true);
    }

    private static (string? WinnerUserId, bool IsDraw) ResolveTimeLimitWinner(ActiveMatchSession session)
    {
        if (session.PlayFormat == (int)PlayFormat.Duel)
        {
            return ResolveDuelCompletedWinner(session);
        }

        // Race tie-breaking on time limit: more correct cells, then more lives remaining
        if (session.Player1.CorrectCells != session.Player2.CorrectCells)
        {
            return session.Player1.CorrectCells > session.Player2.CorrectCells
                ? (session.Player1.UserId, false)
                : (session.Player2.UserId, false);
        }

        if (session.Player1.LivesRemaining != session.Player2.LivesRemaining)
        {
            return session.Player1.LivesRemaining > session.Player2.LivesRemaining
                ? (session.Player1.UserId, false)
                : (session.Player2.UserId, false);
        }

        return (null, true);
    }
}
