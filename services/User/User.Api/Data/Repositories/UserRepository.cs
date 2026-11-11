namespace User.Api.Data.Repositories;

using Microsoft.EntityFrameworkCore;
using User.Api.Domain.Entities;
using User.Api.Domain.Repositories;

public sealed class UserRepository(UserDbContext dbContext) : IUserRepository
{
    public Task<UserAccount?> GetByFirebaseUidAsync(
        string firebaseUid,
        CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .Where(user => user.FirebaseUid == firebaseUid)
            .Select(user => new UserAccount
            {
                Id = user.Id,
                FirebaseUid = user.FirebaseUid,
                Email = user.Email,
                DisplayName = user.DisplayName,
                AvatarUrl = user.AvatarUrl,
                Country = user.Country,
                Role = user.Role,
                Status = user.Status,
                TotalGames = user.TotalGames,
                Wins = user.Wins,
                TotalExp = user.TotalExp,
                PlayerLevel = user.PlayerLevel,
                Trophies = user.Trophies,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt,
            })
            .Take(1)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserAccount>> GetByFirebaseUidsAsync(
        IReadOnlyList<string> firebaseUids,
        int limit,
        CancellationToken cancellationToken)
    {
        if (firebaseUids.Count == 0)
        {
            return Array.Empty<UserAccount>();
        }

        int safeLimit = Math.Clamp(limit, 1, 100);
        return await dbContext.Users
            .AsNoTracking()
            .Where(user => firebaseUids.Contains(user.FirebaseUid))
            .Take(safeLimit)
            .Select(user => new UserAccount
            {
                Id = user.Id,
                FirebaseUid = user.FirebaseUid,
                Email = user.Email,
                DisplayName = user.DisplayName,
                AvatarUrl = user.AvatarUrl,
                Country = user.Country,
                Role = user.Role,
                Status = user.Status,
                TotalGames = user.TotalGames,
                Wins = user.Wins,
                TotalExp = user.TotalExp,
                PlayerLevel = user.PlayerLevel,
                Trophies = user.Trophies,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt,
            })
            .ToListAsync(cancellationToken);
    }

    public Task<UserAccount?> GetByFirebaseUidForUpdateAsync(
        string firebaseUid,
        CancellationToken cancellationToken)
    {
        return dbContext.Users
            .Where(user => user.FirebaseUid == firebaseUid)
            .Take(1)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public Task AddAsync(UserAccount user, CancellationToken cancellationToken)
    {
        return dbContext.Users.AddAsync(user, cancellationToken).AsTask();
    }

    public Task<bool> HasProcessedInboxAsync(string eventId, string handlerName, CancellationToken cancellationToken)
    {
        return dbContext.InboxMessages
            .AsNoTracking()
            .AnyAsync(x => x.EventId == eventId && x.HandlerName == handlerName, cancellationToken);
    }

    public Task AddInboxMessageAsync(Sudoku.Messaging.InboxMessage message, CancellationToken cancellationToken)
    {
        return dbContext.InboxMessages.AddAsync(message, cancellationToken).AsTask();
    }
}
