namespace Support.Api.Domain.Services;

using System.Threading;
using System.Threading.Tasks;

public interface ISupportUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
