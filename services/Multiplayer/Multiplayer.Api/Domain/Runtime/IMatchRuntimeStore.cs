namespace Multiplayer.Api.Domain.Runtime;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Sudoku.Multi.V1;

public interface IMatchRuntimeStore
{
    IReadOnlyCollection<ActiveMatchSession> GetAllActiveInMemory();
    Task<ActiveMatchSession?> GetAsync(Guid matchId, CancellationToken ct = default);
    Task<ActiveMatchSession?> GetByUserIdAsync(string userId, CancellationToken ct = default);
    Task SaveAsync(ActiveMatchSession session, CancellationToken ct = default);
    Task RemoveAsync(Guid matchId, string player1UserId, string player2UserId, CancellationToken ct = default);
}

public interface IRedisLeaderboardCache
{
    Task UpsertPlayerRatingAsync(
        int playFormat,
        string userId,
        string displayName,
        int rating,
        int matchesPlayed,
        int matchesWon,
        int matchesDrawn,
        CancellationToken ct = default);

    Task<List<RankingEntry>?> TryGetTopRankingsAsync(int playFormat, int limit, CancellationToken ct = default);
    Task<RankingEntry?> TryGetCallerRankingAsync(int playFormat, string userId, CancellationToken ct = default);
}
