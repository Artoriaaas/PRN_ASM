namespace Game.Api.Data.Repositories;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Sudoku.Messaging;

public class GameSessionRepository : IGameSessionRepository
{
    private readonly GameDbContext _context;

    public GameSessionRepository(GameDbContext context)
    {
        _context = context;
    }

    public Task<GameSession?> GetActiveSessionAsync(string userId, CancellationToken ct = default)
    {
        return _context.GameSessions
            .AsNoTracking()
            .Include(s => s.Puzzle)
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Status == 1, ct);
    }

    public Task<GameSession?> GetByIdForUpdateAsync(Guid sessionId, string userId, CancellationToken ct = default)
    {
        return _context.GameSessions
            .Include(s => s.Puzzle)
            .Include(s => s.Moves)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId, ct);
    }

    public Task<GameSession?> GetByIdReadOnlyAsync(Guid sessionId, string userId, CancellationToken ct = default)
    {
        return _context.GameSessions
            .AsNoTracking()
            .Include(s => s.Puzzle)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId, ct);
    }

    public Task<List<GameSession>> GetUserActiveSessionsForUpdateAsync(string userId, CancellationToken ct = default)
    {
        return _context.GameSessions
            .Where(s => s.UserId == userId && s.Status == 1)
            .ToListAsync(ct);
    }

    public async Task<List<HighScoreItem>> GetHighScoresAsync(string levelId, int layoutType, int limit, CancellationToken ct = default)
    {
        int clampedLimit = Math.Clamp(limit <= 0 ? 10 : limit, 1, 100);

        // Group by user to pick single highest score per user on that level/layout
        var query = await _context.GameSessions
            .AsNoTracking()
            .Where(s => s.LevelId == levelId && s.LayoutType == layoutType && s.Status == 2)
            .GroupBy(s => s.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                MaxScore = g.Max(x => x.Score),
                MinElapsed = g.Where(x => x.Score == g.Max(m => m.Score)).Min(x => x.ElapsedMs)
            })
            .OrderByDescending(x => x.MaxScore)
            .ThenBy(x => x.MinElapsed)
            .Take(clampedLimit)
            .ToListAsync(ct);

        return query.Select(x => new HighScoreItem(x.UserId, x.MaxScore, x.MinElapsed)).ToList();
    }

    public Task<bool> HasFailedMoveAsync(Guid sessionId, int row, int col, int value, CancellationToken ct = default)
    {
        return _context.GameMoves
            .AsNoTracking()
            .AnyAsync(m => m.SessionId == sessionId && m.Row == row && m.Col == col && m.Value == value && !m.IsCorrect, ct);
    }

    public void Add(GameSession session)
    {
        _context.GameSessions.Add(session);
    }

    public void AddOutboxMessage(OutboxMessage outboxMessage)
    {
        _context.OutboxMessages.Add(outboxMessage);
    }

    public Task<List<OutboxMessage>> GetUnprocessedOutboxMessagesAsync(int limit, CancellationToken ct = default)
    {
        int safeLimit = Math.Clamp(limit <= 0 ? 50 : limit, 1, 100);
        return _context.OutboxMessages
            .Where(m => m.ProcessedAt == null)
            .OrderBy(m => m.CreatedAt)
            .Take(safeLimit)
            .ToListAsync(ct);
    }

    public async Task<(List<Sudoku.Game.V1.GameHistoryItem> Items, int TotalCount, int WinsCount)> GetUserGameHistoryAsync(
        string userId,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        int safeLimit = Math.Clamp(limit <= 0 ? 15 : limit, 1, 100);
        int safeOffset = Math.Max(0, offset);

        var baseQuery = _context.GameSessions
            .AsNoTracking()
            .Where(s => s.UserId == userId && s.Status != 1);

        int totalCount = await baseQuery.CountAsync(ct);
        int winsCount = await baseQuery.CountAsync(s => s.Status == 2, ct);

        var items = await baseQuery
            .OrderByDescending(s => s.FinishedAt ?? s.StartedAt)
            .Skip(safeOffset)
            .Take(safeLimit)
            .Select(s => new Sudoku.Game.V1.GameHistoryItem
            {
                SessionId = s.Id.ToString(),
                LevelId = s.LevelId,
                LayoutType = (Sudoku.Game.V1.LayoutType)s.LayoutType,
                Status = (Sudoku.Game.V1.SessionStatus)s.Status,
                Score = s.Score,
                ElapsedMs = s.ElapsedMs,
                MistakesCount = s.MistakesCount,
                HintsUsed = s.HintsUsed,
                Accuracy = s.Accuracy,
                StartedAt = s.StartedAt.ToString("O"),
                FinishedAt = s.FinishedAt != null ? s.FinishedAt.Value.ToString("O") : string.Empty
            })
            .ToListAsync(ct);

        return (items, totalCount, winsCount);
    }
}
