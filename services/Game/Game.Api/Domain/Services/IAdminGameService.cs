namespace Game.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;

public interface IAdminGameService
{
    Task<IReadOnlyList<GameMode>> ListGameModesAsync(bool onlyActive, CancellationToken cancellationToken);
    Task<GameMode> UpdateGameModeAsync(
        string actorUid,
        Guid id,
        string name,
        string description,
        bool isActive,
        bool notifyPlayers,
        string notifyMsg,
        string reason,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Level>> ListLevelConfigsAsync(CancellationToken cancellationToken);
    Task<Level> UpdateLevelAsync(
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
        CancellationToken cancellationToken);

    Task<IReadOnlyList<TaskDefinition>> ListTaskDefsAsync(CancellationToken cancellationToken);
    Task<TaskDefinition> CreateTaskDefAsync(
        string actorUid,
        string code,
        string description,
        string conditionType,
        int target,
        string progressSource,
        int sortOrder,
        string reason,
        CancellationToken cancellationToken);

    Task<TaskDefinition> UpdateTaskDefAsync(
        string actorUid,
        Guid id,
        string description,
        bool isActive,
        int target,
        int sortOrder,
        string reason,
        CancellationToken cancellationToken);
}
