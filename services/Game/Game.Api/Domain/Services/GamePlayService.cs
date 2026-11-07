namespace Game.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Exceptions;
using Google.Protobuf;
using Microsoft.Extensions.Logging;
using Sudoku.Core;
using Sudoku.Events.V1;
using Sudoku.Game.V1;
using Sudoku.Messaging;

public interface IGamePlayService
{
    Task<GameSession> StartGameAsync(string userId, string levelId, int layoutType, CancellationToken ct = default);
    Task<GameSession?> GetActiveSessionAsync(string userId, CancellationToken ct = default);
    Task<GameSession> GetSessionAsync(string userId, Guid sessionId, CancellationToken ct = default);
    Task<(MoveEvaluationResult Evaluation, GameSession Session)> MakeMoveAsync(string userId, Guid sessionId, int row, int col, int value, CancellationToken ct = default);
    Task<(SmartHintResult Hint, GameSession Session)> UseHintAsync(string userId, Guid sessionId, int? targetRow, int? targetCol, CancellationToken ct = default);
    Task SaveNotesAsync(string userId, Guid sessionId, string notesJson, CancellationToken ct = default);
    Task<GameSession> AbandonGameAsync(string userId, Guid sessionId, CancellationToken ct = default);
    Task<Puzzle> AcquirePuzzleForMatchAsync(string levelId, int layoutType, bool requireEvenEmptyCells, IReadOnlyList<string> excludeUserIds, CancellationToken ct = default);
}

public class GamePlayService : IGamePlayService
{
    private readonly IGameSessionRepository _sessionRepo;
    private readonly ILevelRepository _levelRepo;
    private readonly IPuzzleBankService _puzzleBank;
    private readonly ISoloRulePolicy _rulePolicy;
    private readonly IUnitOfWork _uow;
    private readonly ILogger<GamePlayService> _logger;

    public GamePlayService(
        IGameSessionRepository sessionRepo,
        ILevelRepository levelRepo,
        IPuzzleBankService puzzleBank,
        ISoloRulePolicy rulePolicy,
        IUnitOfWork uow,
        ILogger<GamePlayService> logger)
    {
        _sessionRepo = sessionRepo;
        _levelRepo = levelRepo;
        _puzzleBank = puzzleBank;
        _rulePolicy = rulePolicy;
        _uow = uow;
        _logger = logger;
    }

    public async Task<GameSession> StartGameAsync(string userId, string levelId, int layoutType, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new ValidationException("UserId cannot be empty.");
        }

        // Normalize layout
        int effectiveLayout = layoutType == (int)LayoutType.Unspecified ? (int)LayoutType.Standard : layoutType;

        var level = await _levelRepo.GetByIdAsync(levelId, ct)
            ?? throw new NotFoundException($"Level '{levelId}' was not found.");

        _rulePolicy.ValidateCanStart(level, effectiveLayout);

        // 1. Abandon any currently InProgress session for this user
        var activeSessions = await _sessionRepo.GetUserActiveSessionsForUpdateAsync(userId, ct);
        foreach (var active in activeSessions)
        {
            active.Abandon();
            PublishGameFinishedOutbox(active, isWin: false);
        }

        // 2. Fetch or generate unplayed puzzle
        var puzzle = await _puzzleBank.GetOrCreateUnplayedPuzzleAsync(level, effectiveLayout, userId, ct);

        // 3. Create new game session
        var sessionRules = _rulePolicy.CreateSessionRules(level);
        var session = new GameSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            PuzzleId = puzzle.Id,
            LevelId = level.LevelId,
            LayoutType = effectiveLayout,
            ModeCode = _rulePolicy.ModeCode,
            Status = 1, // InProgress
            CurrentBoard = puzzle.InitialBoard,
            NotesJson = "{}",
            MistakesCount = 0,
            HintsUsed = 0,
            MoveCount = 0,
            CorrectMoveCount = 0,
            Score = 0,
            Accuracy = 0.0,
            ElapsedMs = 0,
            StartedAt = DateTime.UtcNow,
            Puzzle = puzzle
        };
        session.SetRules(sessionRules);

        _sessionRepo.Add(session);

        // Commit all changes in a single transaction
        await _uow.SaveChangesAsync(ct);

        _logger.LogInformation("Started game session {SessionId} for user {UserId} on level {LevelId}",
            session.Id, userId, level.LevelId);

        return session;
    }

    public Task<GameSession?> GetActiveSessionAsync(string userId, CancellationToken ct = default)
    {
        return _sessionRepo.GetActiveSessionAsync(userId, ct);
    }

    public async Task<GameSession> GetSessionAsync(string userId, Guid sessionId, CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdReadOnlyAsync(sessionId, userId, ct);
        if (session == null)
        {
            throw new NotFoundException($"Game session '{sessionId}' was not found.");
        }
        return session;
    }

    public async Task<(MoveEvaluationResult Evaluation, GameSession Session)> MakeMoveAsync(
        string userId,
        Guid sessionId,
        int row,
        int col,
        int value,
        CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdForUpdateAsync(sessionId, userId, ct);
        if (session == null)
        {
            throw new NotFoundException($"Game session '{sessionId}' was not found.");
        }

        if (session.Status != 1)
        {
            throw new InvalidStateException($"Session is not in progress (Current status: {session.Status}).");
        }

        var puzzle = session.Puzzle ?? throw new InvalidStateException("Puzzle relation not loaded for session.");
        var regionMap = new RegionMap(puzzle.RegionMap);

        // Check if this digit was already previously tried on this cell and failed
        bool isDuplicateWrong = await _sessionRepo.HasFailedMoveAsync(sessionId, row, col, value, ct);

        var eval = MoveEvaluator.Evaluate(
            puzzle.InitialBoard,
            session.CurrentBoard,
            puzzle.SolutionBoard,
            regionMap,
            row,
            col,
            value,
            isDuplicateWrong
        );

        if (!eval.IsAllowed)
        {
            throw new ValidationException(eval.FailureReason ?? "Invalid move.");
        }

        var rules = session.GetRules();
        session.ApplyMove(
            row,
            col,
            value,
            eval.IsCorrect,
            eval.IsDuplicateWrong,
            (int)eval.Tier,
            eval.PointsDelta,
            rules.MaxMistakes
        );

        // Check if game completed or failed -> publish outbox event
        if (session.Status == 2) // Completed
        {
            PublishGameFinishedOutbox(session, isWin: true);
        }
        else if (session.Status == 3) // Failed
        {
            PublishGameFinishedOutbox(session, isWin: false);
        }

        await _uow.SaveChangesAsync(ct);

        return (eval, session);
    }

    public async Task<(SmartHintResult Hint, GameSession Session)> UseHintAsync(
        string userId,
        Guid sessionId,
        int? targetRow,
        int? targetCol,
        CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdForUpdateAsync(sessionId, userId, ct);
        if (session == null)
        {
            throw new NotFoundException($"Game session '{sessionId}' was not found.");
        }

        if (session.Status != 1)
        {
            throw new InvalidStateException($"Session is not in progress (Current status: {session.Status}).");
        }

        var rules = session.GetRules();
        if (session.HintsUsed >= rules.MaxHints)
        {
            throw new InvalidStateException($"No hints remaining (Max: {rules.MaxHints}).");
        }

        var puzzle = session.Puzzle ?? throw new InvalidStateException("Puzzle relation not loaded for session.");
        var regionMap = new RegionMap(puzzle.RegionMap);

        var hint = HintFinder.FindHint(session.CurrentBoard, puzzle.SolutionBoard, regionMap, targetRow, targetCol);
        if (hint == null)
        {
            throw new InvalidStateException("No hint could be found. The board may already be complete.");
        }

        session.ApplyHint(hint.Row, hint.Col, hint.Value, (int)hint.Technique, rules.MaxHints);

        if (session.Status == 2) // Completed by hint
        {
            PublishGameFinishedOutbox(session, isWin: true);
        }

        await _uow.SaveChangesAsync(ct);

        return (hint, session);
    }

    public async Task SaveNotesAsync(string userId, Guid sessionId, string notesJson, CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdForUpdateAsync(sessionId, userId, ct);
        if (session == null)
        {
            throw new NotFoundException($"Game session '{sessionId}' was not found.");
        }

        session.UpdateNotes(notesJson);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task<GameSession> AbandonGameAsync(string userId, Guid sessionId, CancellationToken ct = default)
    {
        var session = await _sessionRepo.GetByIdForUpdateAsync(sessionId, userId, ct);
        if (session == null)
        {
            throw new NotFoundException($"Game session '{sessionId}' was not found.");
        }

        if (session.Status == 1)
        {
            session.Abandon();
            PublishGameFinishedOutbox(session, isWin: false);
            await _uow.SaveChangesAsync(ct);
        }

        return session;
    }

    public async Task<Puzzle> AcquirePuzzleForMatchAsync(
        string levelId,
        int layoutType,
        bool requireEvenEmptyCells,
        IReadOnlyList<string> excludeUserIds,
        CancellationToken ct = default)
    {
        string effectiveLevelId = string.IsNullOrWhiteSpace(levelId) ? "easy" : levelId.Trim().ToLowerInvariant();
        int effectiveLayout = layoutType == (int)LayoutType.Unspecified ? (int)LayoutType.Standard : layoutType;

        var level = await _levelRepo.GetByIdAsync(effectiveLevelId, ct)
            ?? throw new NotFoundException($"Level '{effectiveLevelId}' was not found.");

        _rulePolicy.ValidateCanStart(level, effectiveLayout);

        var puzzle = await _puzzleBank.GetOrCreateMatchPuzzleAsync(
            level,
            effectiveLayout,
            requireEvenEmptyCells,
            excludeUserIds,
            ct
        );

        await _uow.SaveChangesAsync(ct);
        return puzzle;
    }

    private void PublishGameFinishedOutbox(GameSession session, bool isWin)
    {
        var evt = new GameFinished
        {
            SessionId = session.Id.ToString(),
            UserId = session.UserId,
            Difficulty = session.LevelId,
            IsWin = isWin,
            DurationSeconds = (int)(session.ElapsedMs / 1000),
            RewardCoins = isWin ? Math.Max(0, session.Score / 10) : 0,
            Score = session.Score,
            ElapsedMs = session.ElapsedMs,
            LayoutType = session.LayoutType,
            MistakesCount = session.MistakesCount,
            HintsUsed = session.HintsUsed
        };

        _sessionRepo.AddOutboxMessage(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(GameFinished),
            UserId = session.UserId,
            Topic = "sudoku.events",
            Payload = evt.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        });
    }
}
