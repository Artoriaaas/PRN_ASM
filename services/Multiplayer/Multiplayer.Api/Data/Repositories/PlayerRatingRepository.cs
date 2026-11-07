namespace Multiplayer.Api.Data.Repositories;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Multiplayer.Api.Domain.Entities;
using Multiplayer.Api.Domain.Services;
using Sudoku.Multi.V1;

public class PlayerRatingRepository : IPlayerRatingRepository
{
    private readonly MultiplayerDbContext _context;

    public PlayerRatingRepository(MultiplayerDbContext context)
    {
        _context = context;
    }

    public Task<PlayerRating?> GetForUpdateAsync(string userId, int playFormat, CancellationToken ct = default)
    {
        return _context.PlayerRatings
            .FirstOrDefaultAsync(r => r.UserId == userId && r.PlayFormat == playFormat, ct);
    }

    public Task<PlayerRating?> GetReadOnlyAsync(string userId, int playFormat, CancellationToken ct = default)
    {
        return _context.PlayerRatings
            .AsNoTracking()
            .Where(r => r.UserId == userId && r.PlayFormat == playFormat)
            .Take(1)
            .FirstOrDefaultAsync(ct);
    }

    public Task<List<PlayerRatingInfo>> GetUserRatingsAsync(string userId, CancellationToken ct = default)
    {
        return _context.PlayerRatings
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderBy(r => r.PlayFormat)
            .Take(10)
            .Select(r => new PlayerRatingInfo
            {
                UserId = r.UserId,
                PlayFormat = (PlayFormat)r.PlayFormat,
                Rating = r.Rating,
                MatchesPlayed = r.MatchesPlayed,
                MatchesWon = r.MatchesWon,
                MatchesDrawn = r.MatchesDrawn,
                Rank = 0
            })
            .ToListAsync(ct);
    }

    public async Task<List<RankingEntry>> GetTopRankingsAsync(int playFormat, int limit, CancellationToken ct = default)
    {
        int safeLimit = Math.Clamp(limit <= 0 ? 50 : limit, 1, 100);
        int effectiveFormat = playFormat <= 0 ? (int)PlayFormat.Race : playFormat;

        var rows = await _context.PlayerRatings
            .AsNoTracking()
            .Where(r => r.PlayFormat == effectiveFormat)
            .OrderByDescending(r => r.Rating)
            .ThenByDescending(r => r.MatchesWon)
            .ThenBy(r => r.UserId)
            .Take(safeLimit)
            .Select(r => new RankingEntry
            {
                UserId = r.UserId,
                PlayerName = r.DisplayName,
                Rating = r.Rating,
                PlayFormat = (PlayFormat)r.PlayFormat,
                MatchesPlayed = r.MatchesPlayed,
                MatchesWon = r.MatchesWon,
                MatchesDrawn = r.MatchesDrawn
            })
            .ToListAsync(ct);

        for (int i = 0; i < rows.Count; i++)
        {
            rows[i].Rank = i + 1;
        }

        return rows;
    }

    public async Task<RankingEntry?> GetCallerRankingEntryAsync(string userId, int playFormat, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        int effectiveFormat = playFormat <= 0 ? (int)PlayFormat.Race : playFormat;

        var entry = await _context.PlayerRatings
            .AsNoTracking()
            .Where(r => r.UserId == userId && r.PlayFormat == effectiveFormat)
            .Take(1)
            .Select(r => new RankingEntry
            {
                UserId = r.UserId,
                PlayerName = r.DisplayName,
                Rating = r.Rating,
                PlayFormat = (PlayFormat)r.PlayFormat,
                MatchesPlayed = r.MatchesPlayed,
                MatchesWon = r.MatchesWon,
                MatchesDrawn = r.MatchesDrawn
            })
            .FirstOrDefaultAsync(ct);

        if (entry == null)
        {
            return null;
        }

        int higherCount = await _context.PlayerRatings
            .AsNoTracking()
            .Where(r => r.PlayFormat == effectiveFormat &&
                        (r.Rating > entry.Rating ||
                         (r.Rating == entry.Rating && r.MatchesWon > entry.MatchesWon)))
            .CountAsync(ct);

        entry.Rank = higherCount + 1;
        return entry;
    }

    public void Add(PlayerRating rating)
    {
        _context.PlayerRatings.Add(rating);
    }
}
