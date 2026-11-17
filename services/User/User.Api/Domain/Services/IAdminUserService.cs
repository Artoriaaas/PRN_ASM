namespace User.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using User.Api.Domain.Entities;

public interface IAdminUserService
{
    Task<(IReadOnlyList<UserAccount> Users, int TotalCount)> ListUsersAsync(
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? sortBy,
        CancellationToken cancellationToken);

    Task<(UserAccount User, IReadOnlyList<EloHistory> EloHistory)> GetUserDetailAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task<UserAccount> BanUserAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        DateTimeOffset? bannedUntil,
        CancellationToken cancellationToken);

    Task<UserAccount> UnbanUserAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken);

    Task<UserAccount> SoftDeleteUserAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken);

    Task<(int NewElo, int OldElo)> AdjustEloAsync(
        string actorFirebaseUid,
        Guid userId,
        int delta,
        string reason,
        string operation,
        CancellationToken cancellationToken);

    Task<UserAccount> GrantAdminRoleAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken);

    Task<UserAccount> RevokeAdminRoleAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken);

    Task<(IReadOnlyList<AuditLog> Logs, int TotalCount)> ListAuditLogsAsync(
        Guid? actorId,
        Guid? targetId,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
}
