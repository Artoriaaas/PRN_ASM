namespace User.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Google.Protobuf;
using Sudoku.Events.V1;
using Sudoku.Messaging;
using User.Api.Domain.Entities;
using User.Api.Domain.Exceptions;
using User.Api.Domain.Repositories;

public sealed class AdminUserService(
    IUserRepository repository,
    IUserUnitOfWork unitOfWork) : IAdminUserService
{
    public Task<(IReadOnlyList<UserAccount> Users, int TotalCount)> ListUsersAsync(
        int page,
        int pageSize,
        string? search,
        string? statusFilter,
        string? sortBy,
        CancellationToken cancellationToken)
    {
        return repository.AdminListUsersAsync(page, pageSize, search, statusFilter, sortBy, cancellationToken);
    }

    public async Task<(UserAccount User, IReadOnlyList<EloHistory> EloHistory)> GetUserDetailAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new ProfileNotFoundException("Không tìm thấy người dùng.");

        var history = await repository.GetRecentEloHistoryAsync(userId, 20, cancellationToken);
        return (user, history);
    }

    public async Task<UserAccount> BanUserAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        DateTimeOffset? bannedUntil,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var actor = await GetActorUserAsync(actorFirebaseUid, cancellationToken);
        var user = await repository.GetByIdForUpdateAsync(userId, cancellationToken)
            ?? throw new ProfileNotFoundException("Không tìm thấy người dùng.");

        if (string.Equals(user.Role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            int adminCount = await repository.CountActiveAdminsAsync(cancellationToken);
            if (adminCount <= 1)
            {
                throw new ProfileValidationException("Không thể khóa tài khoản của Quản trị viên cuối cùng trong hệ thống.");
            }
        }

        var beforeSnapshot = SnapshotUser(user);

        user.Status = "banned";
        user.BanReason = reason;
        user.BannedUntil = bannedUntil;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var afterSnapshot = SnapshotUser(user);

        await repository.AddAuditLogAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actor.Id,
            Action = "BAN_USER",
            TargetType = "USER",
            TargetId = user.Id,
            Before = beforeSnapshot,
            After = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        // Outbox event 1: user.updated.v1
        var userUpdated = new UserUpdated
        {
            UserId = user.Id.ToString(),
            Status = "BANNED",
            Role = user.Role
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserUpdated),
            UserId = user.FirebaseUid,
            Topic = "user.updated.v1",
            Payload = userUpdated.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        // Outbox event 2: user.admin-action.v1 (for Support notifications)
        var adminAction = new UserAdminAction
        {
            UserId = user.FirebaseUid,
            Action = "BANNED",
            Reason = reason,
            BannedUntil = bannedUntil?.ToString("o") ?? string.Empty,
            EloDelta = 0
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserAdminAction),
            UserId = user.FirebaseUid,
            Topic = "user.admin-action.v1",
            Payload = adminAction.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task<UserAccount> UnbanUserAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var actor = await GetActorUserAsync(actorFirebaseUid, cancellationToken);
        var user = await repository.GetByIdForUpdateAsync(userId, cancellationToken)
            ?? throw new ProfileNotFoundException("Không tìm thấy người dùng.");

        var beforeSnapshot = SnapshotUser(user);

        user.Status = "active";
        user.BanReason = null;
        user.BannedUntil = null;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var afterSnapshot = SnapshotUser(user);

        await repository.AddAuditLogAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actor.Id,
            Action = "UNBAN_USER",
            TargetType = "USER",
            TargetId = user.Id,
            Before = beforeSnapshot,
            After = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        // Outbox: user.updated.v1
        var userUpdated = new UserUpdated
        {
            UserId = user.Id.ToString(),
            Status = "ACTIVE",
            Role = user.Role
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserUpdated),
            UserId = user.FirebaseUid,
            Topic = "user.updated.v1",
            Payload = userUpdated.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        // Outbox: user.admin-action.v1
        var adminAction = new UserAdminAction
        {
            UserId = user.FirebaseUid,
            Action = "UNBANNED",
            Reason = reason,
            BannedUntil = string.Empty,
            EloDelta = 0
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserAdminAction),
            UserId = user.FirebaseUid,
            Topic = "user.admin-action.v1",
            Payload = adminAction.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task<UserAccount> SoftDeleteUserAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var actor = await GetActorUserAsync(actorFirebaseUid, cancellationToken);
        var user = await repository.GetByIdForUpdateAsync(userId, cancellationToken)
            ?? throw new ProfileNotFoundException("Không tìm thấy người dùng.");

        if (string.Equals(user.Role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            int adminCount = await repository.CountActiveAdminsAsync(cancellationToken);
            if (adminCount <= 1)
            {
                throw new ProfileValidationException("Không thể xóa Quản trị viên cuối cùng trong hệ thống.");
            }
        }

        var beforeSnapshot = SnapshotUser(user);

        user.Status = "deleted";
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var afterSnapshot = SnapshotUser(user);

        await repository.AddAuditLogAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actor.Id,
            Action = "SOFT_DELETE_USER",
            TargetType = "USER",
            TargetId = user.Id,
            Before = beforeSnapshot,
            After = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        // Outbox: user.updated.v1 (soft delete does NOT send notification to user)
        var userUpdated = new UserUpdated
        {
            UserId = user.Id.ToString(),
            Status = "DELETED",
            Role = user.Role
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserUpdated),
            UserId = user.FirebaseUid,
            Topic = "user.updated.v1",
            Payload = userUpdated.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task<(int NewElo, int OldElo)> AdjustEloAsync(
        string actorFirebaseUid,
        Guid userId,
        int delta,
        string reason,
        string operation,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var actor = await GetActorUserAsync(actorFirebaseUid, cancellationToken);
        var user = await repository.GetByIdForUpdateAsync(userId, cancellationToken)
            ?? throw new ProfileNotFoundException("Không tìm thấy người dùng.");

        int oldElo = user.Trophies;
        int computedElo = operation?.ToUpperInvariant() switch
        {
            "ADD" => oldElo + delta,
            "SUBTRACT" => oldElo - Math.Abs(delta),
            "SET" => delta,
            _ => oldElo + delta
        };

        int newElo = Math.Max(0, computedElo);
        int actualDelta = newElo - oldElo;

        var beforeSnapshot = JsonSerializer.Serialize(new { Elo = oldElo, Level = user.PlayerLevel });

        user.Trophies = newElo;
        user.PlayerLevel = Math.Max(1, 1 + (newElo / 500));
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var afterSnapshot = JsonSerializer.Serialize(new { Elo = newElo, Level = user.PlayerLevel, Operation = operation, Delta = delta });

        // Record elo history
        await repository.AddEloHistoryAsync(new EloHistory
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Delta = actualDelta,
            NewElo = newElo,
            SourceType = "ADMIN",
            SourceId = actor.Id,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        // Audit log
        await repository.AddAuditLogAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actor.Id,
            Action = "ADJUST_ELO",
            TargetType = "USER",
            TargetId = user.Id,
            Before = beforeSnapshot,
            After = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        // Outbox: user.admin-action.v1
        var adminAction = new UserAdminAction
        {
            UserId = user.FirebaseUid,
            Action = "ELO_ADJUSTED",
            Reason = reason,
            BannedUntil = string.Empty,
            EloDelta = actualDelta
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserAdminAction),
            UserId = user.FirebaseUid,
            Topic = "user.admin-action.v1",
            Payload = adminAction.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return (newElo, oldElo);
    }

    public async Task<UserAccount> GrantAdminRoleAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var actor = await GetActorUserAsync(actorFirebaseUid, cancellationToken);
        var user = await repository.GetByIdForUpdateAsync(userId, cancellationToken)
            ?? throw new ProfileNotFoundException("Không tìm thấy người dùng.");

        var beforeSnapshot = SnapshotUser(user);

        user.Role = "admin";
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var afterSnapshot = SnapshotUser(user);

        await repository.AddAuditLogAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actor.Id,
            Action = "GRANT_ROLE_ADMIN",
            TargetType = "USER",
            TargetId = user.Id,
            Before = beforeSnapshot,
            After = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        // Outbox: user.admin-action.v1
        var adminAction = new UserAdminAction
        {
            UserId = user.FirebaseUid,
            Action = "ROLE_CHANGED",
            Reason = reason,
            BannedUntil = string.Empty,
            EloDelta = 0
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserAdminAction),
            UserId = user.FirebaseUid,
            Topic = "user.admin-action.v1",
            Payload = adminAction.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task<UserAccount> RevokeAdminRoleAsync(
        string actorFirebaseUid,
        Guid userId,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var actor = await GetActorUserAsync(actorFirebaseUid, cancellationToken);
        if (actor.Id == userId)
        {
            throw new ProfileValidationException("Admin không được tự thu quyền của chính mình.");
        }

        var user = await repository.GetByIdForUpdateAsync(userId, cancellationToken)
            ?? throw new ProfileNotFoundException("Không tìm thấy người dùng.");

        int adminCount = await repository.CountActiveAdminsAsync(cancellationToken);
        if (adminCount <= 1)
        {
            throw new ProfileValidationException("Không thể thu hồi quyền của Quản trị viên cuối cùng trong hệ thống.");
        }

        var beforeSnapshot = SnapshotUser(user);

        user.Role = "user";
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var afterSnapshot = SnapshotUser(user);

        await repository.AddAuditLogAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = actor.Id,
            Action = "REVOKE_ROLE_ADMIN",
            TargetType = "USER",
            TargetId = user.Id,
            Before = beforeSnapshot,
            After = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);

        // Outbox: user.admin-action.v1
        var adminAction = new UserAdminAction
        {
            UserId = user.FirebaseUid,
            Action = "ROLE_CHANGED",
            Reason = reason,
            BannedUntil = string.Empty,
            EloDelta = 0
        };
        await repository.AddOutboxMessageAsync(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(UserAdminAction),
            UserId = user.FirebaseUid,
            Topic = "user.admin-action.v1",
            Payload = adminAction.ToByteArray(),
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user;
    }

    public Task<(IReadOnlyList<AuditLog> Logs, int TotalCount)> ListAuditLogsAsync(
        Guid? actorId,
        Guid? targetId,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        return repository.ListAuditLogsAsync(actorId, targetId, fromDate, toDate, page, pageSize, cancellationToken);
    }

    private async Task<UserAccount> GetActorUserAsync(string actorFirebaseUid, CancellationToken cancellationToken)
    {
        var actor = await repository.GetByFirebaseUidAsync(actorFirebaseUid, cancellationToken);
        if (actor == null)
        {
            // If actor does not exist yet in User DB, create or fallback
            return new UserAccount { Id = Guid.Empty, FirebaseUid = actorFirebaseUid };
        }
        return actor;
    }

    private static void ValidateReason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ProfileValidationException("Lý do thao tác (reason) là bắt buộc đối với mọi hành động quản trị.");
        }
    }

    private static string SnapshotUser(UserAccount u)
    {
        return JsonSerializer.Serialize(new
        {
            u.Id,
            u.FirebaseUid,
            u.Email,
            u.DisplayName,
            u.Role,
            u.Status,
            u.Trophies,
            u.PlayerLevel,
            u.BanReason,
            u.BannedUntil
        });
    }
}
