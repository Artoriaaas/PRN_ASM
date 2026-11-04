namespace Game.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Exceptions;
using Sudoku.Game.V1;

public interface ILeaderboardService
{
    Task<List<Level>> ListLevelsAsync(CancellationToken ct = default);
    Task<List<HighScoreItem>> GetHighScoresAsync(string levelId, int layoutType, int limit, CancellationToken ct = default);
}

public class LeaderboardService : ILeaderboardService
{
    private readonly ILevelRepository _levelRepo;
    private readonly IGameSessionRepository _sessionRepo;

    public LeaderboardService(ILevelRepository levelRepo, IGameSessionRepository sessionRepo)
    {
        _levelRepo = levelRepo;
        _sessionRepo = sessionRepo;
    }

    public Task<List<Level>> ListLevelsAsync(CancellationToken ct = default)
    {
        return _levelRepo.GetActiveLevelsAsync(ct);
    }

    public async Task<List<HighScoreItem>> GetHighScoresAsync(string levelId, int layoutType, int limit, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(levelId))
        {
            throw new ValidationException("LevelId must be specified.");
        }

        int effectiveLayout = layoutType == (int)LayoutType.Unspecified ? (int)LayoutType.Standard : layoutType;

        return await _sessionRepo.GetHighScoresAsync(levelId, effectiveLayout, limit, ct);
    }
}
