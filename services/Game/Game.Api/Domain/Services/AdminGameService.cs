namespace Game.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Data;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Exceptions;
using Google.Protobuf;
using Microsoft.EntityFrameworkCore;
using Sudoku.Events.V1;
using Sudoku.Messaging;

public sealed class AdminGameService(
    GameDbContext dbContext,
    IUnitOfWork unitOfWork) : IAdminGameService
{
    public async Task<IReadOnlyList<GameMode>> ListGameModesAsync(bool onlyActive, CancellationToken cancellationToken)
    {
        var query = dbContext.GameModes.AsNoTracking();
        if (onlyActive)
        {
            query = query.Where(m => m.IsActive);
        }
        return await query.OrderBy(m => m.SortOrder).ToListAsync(cancellationToken);
    }

    public async Task<GameMode> UpdateGameModeAsync(
        string actorUid,
        Guid id,
        string name,
        string description,
        bool isActive,
        bool notifyPlayers,
        string notifyMsg,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var mode = await dbContext.GameModes.FirstOrDefaultAsync(m => m.Id == id, cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy biến thể chế độ chơi với ID {id}.");

        var beforeSnapshot = JsonSerializer.Serialize(new
        {
            mode.Name,
            mode.Description,
            mode.IsActive,
            mode.Version
        });

        if (!string.IsNullOrWhiteSpace(name)) mode.Name = name.Trim();
        if (description != null) mode.Description = description.Trim();
        mode.IsActive = isActive;
        mode.Version += 1;
        mode.UpdatedAt = DateTime.UtcNow;

        var afterSnapshot = JsonSerializer.Serialize(new
        {
            mode.Name,
            mode.Description,
            mode.IsActive,
            mode.Version
        });

        await dbContext.GameAuditLogs.AddAsync(new GameAuditLog
        {
            Id = Guid.NewGuid(),
            ActorFirebaseUid = actorUid,
            Action = "UPDATE_GAME_MODE",
            TargetType = "GAME_MODE",
            TargetId = mode.Id.ToString(),
            BeforeJson = beforeSnapshot,
            AfterJson = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        if (notifyPlayers && !string.IsNullOrWhiteSpace(notifyMsg))
        {
            var evt = new GameRulesChanged
            {
                Title = $"Cập nhật biến thể: {mode.Name}",
                Content = notifyMsg.Trim(),
                EffectiveAt = DateTime.UtcNow.ToString("o"),
                ChangedEntity = "GAME_MODE"
            };

            await dbContext.OutboxMessages.AddAsync(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventId = Guid.NewGuid().ToString(),
                Type = nameof(GameRulesChanged),
                UserId = actorUid,
                Topic = "game.rules-changed.v1",
                Payload = evt.ToByteArray(),
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return mode;
    }

    public async Task<IReadOnlyList<Level>> ListLevelConfigsAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Levels
            .AsNoTracking()
            .OrderBy(l => l.SortOrder)
            .ToListAsync(cancellationToken);
    }

    public async Task<Level> UpdateLevelAsync(
        string actorUid,
        string levelId,
        int minClues,
        int maxClues,
        int maxMistakes,
        int maxHints,
        bool isActive,
        double scoreMultiplier,
        int timeLimitSeconds,
        bool notifyPlayers,
        string notifyMsg,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        if (minClues < 17 || maxClues > 80 || minClues > maxClues)
        {
            throw new ValidationException("Số ô gợi ý không hợp lệ: phải trong khoảng 17 đến 80 và min <= max.");
        }

        if (maxMistakes < 1)
        {
            throw new ValidationException("Số lần sai tối đa phải >= 1.");
        }

        if (maxHints < 0)
        {
            throw new ValidationException("Số gợi ý tối đa phải >= 0.");
        }

        var level = await dbContext.Levels.FirstOrDefaultAsync(l => l.LevelId == levelId, cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy độ khó {levelId}.");

        var beforeSnapshot = JsonSerializer.Serialize(new
        {
            level.MinClues,
            level.MaxClues,
            level.MaxMistakes,
            level.MaxHints,
            level.IsActive,
            level.ScoreMultiplier,
            level.TimeLimitSeconds,
            level.Version
        });

        level.MinClues = minClues;
        level.MaxClues = maxClues;
        level.MaxMistakes = maxMistakes;
        level.MaxHints = maxHints;
        level.IsActive = isActive;
        level.ScoreMultiplier = scoreMultiplier > 0 ? scoreMultiplier : 1.0;
        level.TimeLimitSeconds = timeLimitSeconds > 0 ? timeLimitSeconds : null;
        level.Version += 1;
        level.UpdatedAt = DateTime.UtcNow;

        var afterSnapshot = JsonSerializer.Serialize(new
        {
            level.MinClues,
            level.MaxClues,
            level.MaxMistakes,
            level.MaxHints,
            level.IsActive,
            level.ScoreMultiplier,
            level.TimeLimitSeconds,
            level.Version
        });

        await dbContext.GameAuditLogs.AddAsync(new GameAuditLog
        {
            Id = Guid.NewGuid(),
            ActorFirebaseUid = actorUid,
            Action = "UPDATE_LEVEL",
            TargetType = "LEVEL",
            TargetId = level.LevelId,
            BeforeJson = beforeSnapshot,
            AfterJson = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        if (notifyPlayers && !string.IsNullOrWhiteSpace(notifyMsg))
        {
            var evt = new GameRulesChanged
            {
                Title = $"Cập nhật độ khó: {level.Name}",
                Content = notifyMsg.Trim(),
                EffectiveAt = DateTime.UtcNow.ToString("o"),
                ChangedEntity = "LEVEL"
            };

            await dbContext.OutboxMessages.AddAsync(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventId = Guid.NewGuid().ToString(),
                Type = nameof(GameRulesChanged),
                UserId = actorUid,
                Topic = "game.rules-changed.v1",
                Payload = evt.ToByteArray(),
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return level;
    }

    public async Task<IReadOnlyList<TaskDefinition>> ListTaskDefsAsync(CancellationToken cancellationToken)
    {
        return await dbContext.TaskDefinitions
            .AsNoTracking()
            .OrderBy(t => t.SortOrder)
            .ToListAsync(cancellationToken);
    }

    public async Task<TaskDefinition> CreateTaskDefAsync(
        string actorUid,
        string code,
        string description,
        string conditionType,
        int target,
        string progressSource,
        int sortOrder,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        string cleanCode = code?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanCode))
            throw new ValidationException("Mã nhiệm vụ không được để trống.");

        bool exists = await dbContext.TaskDefinitions.AnyAsync(t => t.Code == cleanCode, cancellationToken);
        if (exists)
            throw new ValidationException($"Mã nhiệm vụ '{cleanCode}' đã tồn tại.");

        var task = new TaskDefinition
        {
            Id = Guid.NewGuid(),
            Code = cleanCode,
            Description = description?.Trim() ?? string.Empty,
            ConditionType = conditionType?.Trim() ?? "COMPLETE_GAMES",
            Target = Math.Max(1, target),
            ProgressSource = progressSource?.Trim() ?? "solo",
            IsActive = true,
            SortOrder = sortOrder,
            UpdatedAt = DateTime.UtcNow
        };

        await dbContext.TaskDefinitions.AddAsync(task, cancellationToken);

        await dbContext.GameAuditLogs.AddAsync(new GameAuditLog
        {
            Id = Guid.NewGuid(),
            ActorFirebaseUid = actorUid,
            Action = "CREATE_TASK_DEF",
            TargetType = "TASK_DEF",
            TargetId = task.Id.ToString(),
            BeforeJson = "{}",
            AfterJson = JsonSerializer.Serialize(task),
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return task;
    }

    public async Task<TaskDefinition> UpdateTaskDefAsync(
        string actorUid,
        Guid id,
        string description,
        bool isActive,
        int target,
        int sortOrder,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var task = await dbContext.TaskDefinitions.FirstOrDefaultAsync(t => t.Id == id, cancellationToken)
            ?? throw new NotFoundException($"Không tìm thấy định nghĩa nhiệm vụ với ID {id}.");

        var beforeSnapshot = JsonSerializer.Serialize(task);

        if (!string.IsNullOrWhiteSpace(description)) task.Description = description.Trim();
        task.IsActive = isActive;
        if (target > 0) task.Target = target;
        task.SortOrder = sortOrder;
        task.UpdatedAt = DateTime.UtcNow;

        var afterSnapshot = JsonSerializer.Serialize(task);

        await dbContext.GameAuditLogs.AddAsync(new GameAuditLog
        {
            Id = Guid.NewGuid(),
            ActorFirebaseUid = actorUid,
            Action = "UPDATE_TASK_DEF",
            TargetType = "TASK_DEF",
            TargetId = task.Id.ToString(),
            BeforeJson = beforeSnapshot,
            AfterJson = afterSnapshot,
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return task;
    }

    private static void ValidateReason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ValidationException("Lý do thao tác (reason) là bắt buộc đối với mọi hành động quản trị.");
    }
}
