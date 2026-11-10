namespace Game.Api.Data.Repositories;

using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Services;
using Microsoft.EntityFrameworkCore;

public class PuzzleRepository : IPuzzleRepository
{
    private readonly GameDbContext _context;

    public PuzzleRepository(GameDbContext context)
    {
        _context = context;
    }

    public Task<Puzzle?> GetUnplayedPuzzleAsync(string levelId, int layoutType, string userId, CancellationToken ct = default)
    {
        return _context.Puzzles
            .Where(p => p.LevelId == levelId &&
                        p.LayoutType == layoutType &&
                        p.IsActive &&
                        !_context.GameSessions.Any(s => s.UserId == userId && s.PuzzleId == p.Id))
            .OrderBy(p => p.PlayCount)
            .FirstOrDefaultAsync(ct);
    }

    public Task<Puzzle?> GetPuzzleForMatchAsync(
        string levelId,
        int layoutType,
        bool requireEvenEmptyCells,
        IReadOnlyList<string> excludeUserIds,
        CancellationToken ct = default)
    {
        var query = _context.Puzzles
            .Where(p => p.LevelId == levelId &&
                        p.LayoutType == layoutType &&
                        p.IsActive);

        if (requireEvenEmptyCells)
        {
            query = query.Where(p => p.ClueCount % 2 == 1);
        }

        if (excludeUserIds.Count > 0)
        {
            query = query.Where(p => !_context.GameSessions.Any(s => excludeUserIds.Contains(s.UserId) && s.PuzzleId == p.Id));
        }

        return query
            .OrderBy(p => p.PlayCount)
            .FirstOrDefaultAsync(ct);
    }

    public Task<int> CountUnplayedPuzzlesAsync(string levelId, int layoutType, CancellationToken ct = default)
    {
        return _context.Puzzles
            .AsNoTracking()
            .CountAsync(p => p.LevelId == levelId && p.LayoutType == layoutType && p.IsActive && p.PlayCount == 0, ct);
    }

    public Task<bool> ExistsHashAsync(string puzzleHash, CancellationToken ct = default)
    {
        return _context.Puzzles
            .AsNoTracking()
            .AnyAsync(p => p.PuzzleHash == puzzleHash, ct);
    }

    public void Add(Puzzle puzzle)
    {
        _context.Puzzles.Add(puzzle);
    }
}
