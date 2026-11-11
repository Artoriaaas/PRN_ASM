namespace Support.Api.Data;

using System.Threading;
using System.Threading.Tasks;
using Support.Api.Domain.Services;

public sealed class SupportUnitOfWork(SupportDbContext dbContext) : ISupportUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}
