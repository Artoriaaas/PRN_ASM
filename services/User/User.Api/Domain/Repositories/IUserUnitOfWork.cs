namespace User.Api.Domain.Repositories;

public interface IUserUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
