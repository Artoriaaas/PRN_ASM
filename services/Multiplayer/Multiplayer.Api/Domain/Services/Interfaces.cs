namespace Multiplayer.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Multiplayer.Api.Domain.Entities;
using Sudoku.Messaging;
using Sudoku.Multi.V1;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface IMatchRepository
{
    Task<Match?> GetByIdForUpdateAsync(Guid matchId, CancellationToken ct = default);
    Task<MatchDetail?> GetMatchDetailAsync(Guid matchId, CancellationToken ct = default);
    Task<(List<MatchHistoryItem> Items, int TotalCount, int WinsCount)> GetMatchHistoryAsync(string userId, int playFormat, int limit, int offset, CancellationToken ct = default);
    Task<List<OutboxMessage>> GetUnprocessedOutboxMessagesAsync(int limit, CancellationToken ct = default);
    void Add(Match match);
    void AddMoves(IEnumerable<MatchMove> moves);
    void AddOutboxMessage(OutboxMessage outboxMessage);
}

public interface IPlayerRatingRepository
{
    Task<PlayerRating?> GetForUpdateAsync(string userId, int playFormat, CancellationToken ct = default);
    Task<PlayerRating?> GetReadOnlyAsync(string userId, int playFormat, CancellationToken ct = default);
    Task<List<PlayerRatingInfo>> GetUserRatingsAsync(string userId, CancellationToken ct = default);
    Task<List<RankingEntry>> GetTopRankingsAsync(int playFormat, int limit, CancellationToken ct = default);
    Task<RankingEntry?> GetCallerRankingEntryAsync(string userId, int playFormat, CancellationToken ct = default);
    void Add(PlayerRating rating);
}
