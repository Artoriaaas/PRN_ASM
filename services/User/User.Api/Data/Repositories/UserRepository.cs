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

    public async Task<(IReadOnlyList<UserAccount> Items, int TotalCount)> AdminListUsersAsync(
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? sortBy,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(u => u.DisplayName.ToLower().Contains(term) || u.Email.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            var status = statusFilter.Trim().ToLower();
            query = query.Where(u => u.Status.ToLower() == status);
        }

        int totalCount = await query.CountAsync(cancellationToken);

        query = string.Equals(sortBy, "elo", StringComparison.OrdinalIgnoreCase)
            ? query.OrderByDescending(u => u.Trophies).ThenByDescending(u => u.CreatedAt)
            : query.OrderByDescending(u => u.CreatedAt);

        int safePage = Math.Max(1, page);
        int safePageSize = Math.Clamp(pageSize, 1, 100);

        var items = await query
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public Task<UserAccount?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == id)
            .Take(1)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public Task<UserAccount?> GetByIdForUpdateAsync(Guid id, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .Where(u => u.Id == id)
            .Take(1)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public Task<int> CountActiveAdminsAsync(CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .CountAsync(u => u.Role.ToLower() == "admin" && u.Status.ToLower() != "deleted", cancellationToken);
    }

    public Task AddAuditLogAsync(AuditLog log, CancellationToken cancellationToken)
    {
        return dbContext.AuditLogs.AddAsync(log, cancellationToken).AsTask();
    }

    public async Task<(IReadOnlyList<AuditLog> Items, int TotalCount)> ListAuditLogsAsync(
        Guid? actorId,
        Guid? targetId,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = dbContext.AuditLogs.AsNoTracking();

        if (actorId.HasValue && actorId.Value != Guid.Empty)
        {
            query = query.Where(l => l.ActorId == actorId.Value);
        }

        if (targetId.HasValue && targetId.Value != Guid.Empty)
        {
            query = query.Where(l => l.TargetId == targetId.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(l => l.CreatedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(l => l.CreatedAt <= toDate.Value);
        }

        int totalCount = await query.CountAsync(cancellationToken);

        int safePage = Math.Max(1, page);
        int safePageSize = Math.Clamp(pageSize, 1, 100);

        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public Task AddEloHistoryAsync(EloHistory entry, CancellationToken cancellationToken)
    {
        return dbContext.EloHistories.AddAsync(entry, cancellationToken).AsTask();
    }

    public async Task<IReadOnlyList<EloHistory>> GetRecentEloHistoryAsync(Guid userId, int limit, CancellationToken cancellationToken)
    {
        int safeLimit = Math.Clamp(limit, 1, 50);
        return await dbContext.EloHistories
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);
    }

    public Task AddOutboxMessageAsync(Sudoku.Messaging.OutboxMessage message, CancellationToken cancellationToken)
    {
        return dbContext.OutboxMessages.AddAsync(message, cancellationToken).AsTask();
    }

    public async Task<IReadOnlyList<Sudoku.Messaging.OutboxMessage>> GetUnprocessedOutboxMessagesAsync(int limit, CancellationToken cancellationToken)
    {
        int safeLimit = Math.Clamp(limit, 1, 100);
        return await dbContext.OutboxMessages
            .Where(x => x.ProcessedAt == null)
            .OrderBy(x => x.CreatedAt)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);
    }
}
