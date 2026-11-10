namespace Game.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Sudoku.Messaging;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface ILevelRepository
{
    Task<List<Level>> GetActiveLevelsAsync(CancellationToken ct = default);
    Task<Level?> GetByIdAsync(string levelId, CancellationToken ct = default);
    Task<bool> HasAnyAsync(CancellationToken ct = default);
    void Add(Level level);
}

public interface IPuzzleRepository
{
    Task<Puzzle?> GetUnplayedPuzzleAsync(string levelId, int layoutType, string userId, CancellationToken ct = default);
    Task<Puzzle?> GetPuzzleForMatchAsync(string levelId, int layoutType, bool requireEvenEmptyCells, IReadOnlyList<string> excludeUserIds, CancellationToken ct = default);
    Task<int> CountUnplayedPuzzlesAsync(string levelId, int layoutType, CancellationToken ct = default);
    Task<bool> ExistsHashAsync(string puzzleHash, CancellationToken ct = default);
    void Add(Puzzle puzzle);
}

public sealed record HighScoreItem(string UserId, int Score, long ElapsedMs);

public interface IGameSessionRepository
{
    Task<GameSession?> GetActiveSessionAsync(string userId, CancellationToken ct = default);
    Task<GameSession?> GetByIdForUpdateAsync(Guid sessionId, string userId, CancellationToken ct = default);
    Task<GameSession?> GetByIdReadOnlyAsync(Guid sessionId, string userId, CancellationToken ct = default);
    Task<List<GameSession>> GetUserActiveSessionsForUpdateAsync(string userId, CancellationToken ct = default);
    Task<List<HighScoreItem>> GetHighScoresAsync(string levelId, int layoutType, int limit, CancellationToken ct = default);
    Task<bool> HasFailedMoveAsync(Guid sessionId, int row, int col, int value, CancellationToken ct = default);
    void Add(GameSession session);
    void AddOutboxMessage(OutboxMessage outboxMessage);
}
