namespace Game.Api.Data;

using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Services;

public class UnitOfWork : IUnitOfWork
{
    private readonly GameDbContext _context;

    public UnitOfWork(GameDbContext context)
    {
        _context = context;
    }

    public Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return _context.SaveChangesAsync(ct);
    }
}
