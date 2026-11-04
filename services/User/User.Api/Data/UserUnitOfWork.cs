namespace User.Api.Data;

using User.Api.Domain.Repositories;

public sealed class UserUnitOfWork(UserDbContext dbContext) : IUserUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}
