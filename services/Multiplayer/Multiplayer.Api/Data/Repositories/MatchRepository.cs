namespace Multiplayer.Api.Data.Repositories;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Multiplayer.Api.Domain.Entities;
using Multiplayer.Api.Domain.Services;
using Sudoku.Messaging;
using Sudoku.Multi.V1;

public class MatchRepository : IMatchRepository
{
    private readonly MultiplayerDbContext _context;

    public MatchRepository(MultiplayerDbContext context)
    {
        _context = context;
    }

    public Task<Match?> GetByIdForUpdateAsync(Guid matchId, CancellationToken ct = default)
    {
        return _context.Matches
            .Include(m => m.Players)
            .FirstOrDefaultAsync(m => m.Id == matchId, ct);
    }

    public async Task<MatchDetail?> GetMatchDetailAsync(Guid matchId, CancellationToken ct = default)
    {
        var raw = await _context.Matches
            .AsNoTracking()
            .Where(m => m.Id == matchId)
            .Take(1)
            .Select(m => new
            {
                m.Id,
                m.PlayFormat,
                m.BoardLayout,
                m.LevelId,
                m.Status,
                m.InitialBoard,
                m.RegionMap,
                m.SharedBoard,
                m.EndReason,
                m.DurationMs,
                m.StartedAt,
                m.FinishedAt,
                Players = m.Players
                    .OrderBy(p => p.TurnOrder)
                    .Select(p => new MatchPlayerDetail
                    {
                        UserId = p.UserId,
                        DisplayName = p.DisplayName,
                        TurnOrder = p.TurnOrder,
                        LivesRemaining = p.LivesRemaining,
                        MistakesCount = p.MistakesCount,
                        CorrectCells = p.CorrectCells,
                        Score = p.Score,
                        TimeoutCount = p.TimeoutCount,
                        Result = (MatchResult)p.Result,
                        RatingBefore = p.RatingBefore,
                        RatingDelta = p.RatingDelta,
                        CompletionMs = p.CompletionMs
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (raw == null)
        {
            return null;
        }

        var detail = new MatchDetail
        {
            MatchId = raw.Id.ToString(),
            PlayFormat = (PlayFormat)raw.PlayFormat,
            BoardLayout = (BoardLayoutType)raw.BoardLayout,
            LevelId = raw.LevelId,
            Status = (MatchStatus)raw.Status,
            InitialBoard = raw.InitialBoard,
            RegionMap = raw.RegionMap,
            SharedBoard = raw.SharedBoard,
            EndReason = raw.EndReason,
            DurationMs = raw.DurationMs,
            StartedAt = raw.StartedAt.ToString("O"),
            FinishedAt = raw.FinishedAt?.ToString("O") ?? string.Empty
        };
        detail.Players.AddRange(raw.Players);
        return detail;
    }

    public async Task<(List<MatchHistoryItem> Items, int TotalCount, int WinsCount)> GetMatchHistoryAsync(
        string userId,
        int playFormat,
        int limit,
        int offset = 0,
        CancellationToken ct = default)
    {
        int safeLimit = Math.Clamp(limit <= 0 ? 20 : limit, 1, 100);
        int safeOffset = Math.Max(0, offset);

        var query = _context.MatchPlayers
            .AsNoTracking()
            .Where(p => p.UserId == userId && p.FinishedAt != null);

        if (playFormat > 0)
        {
            query = query.Where(p => p.PlayFormat == playFormat);
        }

        int totalCount = await query.CountAsync(ct);
        int winsCount = await query.CountAsync(p => p.Result == (int)MatchResult.Win, ct);

        var items = await query
            .OrderByDescending(p => p.FinishedAt)
            .Skip(safeOffset)
            .Take(safeLimit)
            .Select(p => new MatchHistoryItem
            {
                MatchId = p.MatchId.ToString(),
                OpponentName = p.OpponentName,
                IsWin = p.Result == (int)MatchResult.Win,
                RatingDelta = p.RatingDelta,
                CompletedAt = p.FinishedAt != null ? p.FinishedAt.Value.ToString("O") : string.Empty,
                OpponentUserId = p.OpponentUserId,
                PlayFormat = (PlayFormat)p.PlayFormat,
                BoardLayout = (BoardLayoutType)p.BoardLayout,
                LevelId = p.LevelId,
                Result = (MatchResult)p.Result,
                Score = p.Score,
                OpponentScore = p.OpponentScore,
                DurationSeconds = (int)(p.CompletionMs / 1000),
                EndReason = p.EndReason
            })
            .ToListAsync(ct);

        return (items, totalCount, winsCount);
    }

    public Task<List<OutboxMessage>> GetUnprocessedOutboxMessagesAsync(int limit, CancellationToken ct = default)
    {
        int safeLimit = Math.Clamp(limit <= 0 ? 50 : limit, 1, 200);
        return _context.OutboxMessages
            .Where(m => m.ProcessedAt == null)
            .OrderBy(m => m.CreatedAt)
            .Take(safeLimit)
            .ToListAsync(ct);
    }

    public void Add(Match match)
    {
        _context.Matches.Add(match);
    }

    public void AddMoves(IEnumerable<MatchMove> moves)
    {
        _context.MatchMoves.AddRange(moves);
    }

    public void AddOutboxMessage(OutboxMessage outboxMessage)
    {
        _context.OutboxMessages.Add(outboxMessage);
    }
}
