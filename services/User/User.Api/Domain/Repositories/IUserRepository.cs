namespace User.Api.Domain.Repositories;

using User.Api.Domain.Entities;

public interface IUserRepository
{
    Task<UserAccount?> GetByFirebaseUidAsync(string firebaseUid, CancellationToken cancellationToken);
    Task<IReadOnlyList<UserAccount>> GetByFirebaseUidsAsync(IReadOnlyList<string> firebaseUids, int limit, CancellationToken cancellationToken);
    Task<UserAccount?> GetByFirebaseUidForUpdateAsync(string firebaseUid, CancellationToken cancellationToken);
    Task AddAsync(UserAccount user, CancellationToken cancellationToken);
    Task<bool> HasProcessedInboxAsync(string eventId, string handlerName, CancellationToken cancellationToken);
    Task AddInboxMessageAsync(Sudoku.Messaging.InboxMessage message, CancellationToken cancellationToken);
}
