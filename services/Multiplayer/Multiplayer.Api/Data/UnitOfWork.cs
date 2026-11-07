namespace Multiplayer.Api.Data;

using System.Threading;
using System.Threading.Tasks;
using Multiplayer.Api.Domain.Services;

public class UnitOfWork : IUnitOfWork
{
    private readonly MultiplayerDbContext _context;

    public UnitOfWork(MultiplayerDbContext context)
    {
        _context = context;
    }

    public Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return _context.SaveChangesAsync(ct);
    }
}
