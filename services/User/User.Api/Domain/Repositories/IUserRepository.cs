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

    // Admin Repository Operations
    Task<(IReadOnlyList<UserAccount> Items, int TotalCount)> AdminListUsersAsync(int page, int pageSize, string? search, string? statusFilter, string? sortBy, CancellationToken cancellationToken);
    Task<UserAccount?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<UserAccount?> GetByIdForUpdateAsync(Guid id, CancellationToken cancellationToken);
    Task<int> CountActiveAdminsAsync(CancellationToken cancellationToken);
    Task AddAuditLogAsync(AuditLog log, CancellationToken cancellationToken);
    Task<(IReadOnlyList<AuditLog> Items, int TotalCount)> ListAuditLogsAsync(Guid? actorId, Guid? targetId, DateTimeOffset? fromDate, DateTimeOffset? toDate, int page, int pageSize, CancellationToken cancellationToken);
    Task AddEloHistoryAsync(EloHistory entry, CancellationToken cancellationToken);
    Task<IReadOnlyList<EloHistory>> GetRecentEloHistoryAsync(Guid userId, int limit, CancellationToken cancellationToken);
    Task AddOutboxMessageAsync(Sudoku.Messaging.OutboxMessage message, CancellationToken cancellationToken);
    Task<IReadOnlyList<Sudoku.Messaging.OutboxMessage>> GetUnprocessedOutboxMessagesAsync(int limit, CancellationToken cancellationToken);
}
