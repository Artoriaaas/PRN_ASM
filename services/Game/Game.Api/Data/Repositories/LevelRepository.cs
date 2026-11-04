namespace Game.Api.Data.Repositories;

using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Services;
using Microsoft.EntityFrameworkCore;

public class LevelRepository : ILevelRepository
{
    private readonly GameDbContext _context;

    public LevelRepository(GameDbContext context)
    {
        _context = context;
    }

    public Task<List<Level>> GetActiveLevelsAsync(CancellationToken ct = default)
    {
        return _context.Levels
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder)
            .Take(20)
            .ToListAsync(ct);
    }

    public Task<Level?> GetByIdAsync(string levelId, CancellationToken ct = default)
    {
        return _context.Levels
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.LevelId == levelId, ct);
    }

    public Task<bool> HasAnyAsync(CancellationToken ct = default)
    {
        return _context.Levels.AsNoTracking().AnyAsync(ct);
    }

    public void Add(Level level)
    {
        _context.Levels.Add(level);
    }
}
