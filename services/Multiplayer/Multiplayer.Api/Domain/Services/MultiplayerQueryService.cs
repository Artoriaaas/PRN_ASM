namespace Multiplayer.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using global::Grpc.Core;
using Microsoft.Extensions.Logging;
using Multiplayer.Api.Domain.Exceptions;
using Multiplayer.Api.Domain.Runtime;
using Sudoku.Multi.V1;
using Sudoku.User.V1;

public interface IMultiplayerQueryService
{
    Task<GetRankingsResponse> GetRankingsAsync(string? callerUserId, int playFormat, int limit, CancellationToken ct = default);
    Task<GetMatchHistoryResponse> GetMatchHistoryAsync(string userId, int playFormat, int limit, CancellationToken ct = default);
    Task<GetPlayerRatingsResponse> GetPlayerRatingsAsync(string userId, CancellationToken ct = default);
    Task<MatchDetail> GetMatchAsync(Guid matchId, CancellationToken ct = default);
}

public sealed class MultiplayerQueryService : IMultiplayerQueryService
{
    private readonly IMatchRepository _matchRepo;
    private readonly IPlayerRatingRepository _ratingRepo;
    private readonly IRedisLeaderboardCache _leaderboardCache;
    private readonly UserService.UserServiceClient? _userClient;
    private readonly ILogger<MultiplayerQueryService> _logger;

    public MultiplayerQueryService(
        IMatchRepository matchRepo,
        IPlayerRatingRepository ratingRepo,
        IRedisLeaderboardCache leaderboardCache,
        ILogger<MultiplayerQueryService> logger,
        UserService.UserServiceClient? userClient = null)
    {
        _matchRepo = matchRepo;
        _ratingRepo = ratingRepo;
        _leaderboardCache = leaderboardCache;
        _logger = logger;
        _userClient = userClient;
    }

    public async Task<GetRankingsResponse> GetRankingsAsync(
        string? callerUserId,
        int playFormat,
        int limit,
        CancellationToken ct = default)
    {
        int effectiveFormat = playFormat == (int)PlayFormat.Duel ? (int)PlayFormat.Duel : (int)PlayFormat.Race;
        int safeLimit = Math.Clamp(limit <= 0 ? 50 : limit, 1, 100);

        // 1. Try Redis Sorted Set first (< 1ms)
        var topEntries = await _leaderboardCache.TryGetTopRankingsAsync(effectiveFormat, safeLimit, ct);
        RankingEntry? callerEntry = null;

        if (topEntries == null)
        {
            // Fallback to PostgreSQL & warm up Redis cache
            topEntries = await _ratingRepo.GetTopRankingsAsync(effectiveFormat, safeLimit, ct);
            foreach (var item in topEntries)
            {
                await _leaderboardCache.UpsertPlayerRatingAsync(
                    effectiveFormat,
                    item.UserId,
                    item.PlayerName,
                    item.Rating,
                    item.MatchesPlayed,
                    item.MatchesWon,
                    item.MatchesDrawn,
                    ct);
            }
        }

        if (!string.IsNullOrWhiteSpace(callerUserId))
        {
            callerEntry = topEntries.FirstOrDefault(x => string.Equals(x.UserId, callerUserId, StringComparison.Ordinal))
                ?? await _leaderboardCache.TryGetCallerRankingAsync(effectiveFormat, callerUserId, ct)
                ?? await _ratingRepo.GetCallerRankingEntryAsync(callerUserId, effectiveFormat, ct);
        }

        await EnrichMissingDisplayNamesAsync(topEntries, callerEntry, ct);

        var response = new GetRankingsResponse();
        response.Rankings.AddRange(topEntries);
        if (callerEntry != null)
        {
            response.CallerEntry = callerEntry;
        }

        return response;
    }

    public async Task<GetMatchHistoryResponse> GetMatchHistoryAsync(
        string userId,
        int playFormat,
        int limit,
        CancellationToken ct = default)
    {
        var items = await _matchRepo.GetMatchHistoryAsync(userId, playFormat, limit, ct);
        var response = new GetMatchHistoryResponse();
        response.Matches.AddRange(items);
        return response;
    }

    public async Task<GetPlayerRatingsResponse> GetPlayerRatingsAsync(string userId, CancellationToken ct = default)
    {
        var ratings = await _ratingRepo.GetUserRatingsAsync(userId, ct);

        foreach (var format in new[] { PlayFormat.Race, PlayFormat.Duel })
        {
            var existing = ratings.FirstOrDefault(r => r.PlayFormat == format);
            if (existing == null)
            {
                ratings.Add(new PlayerRatingInfo
                {
                    UserId = userId,
                    PlayFormat = format,
                    Rating = Entities.PlayerRating.DefaultInitialRating,
                    MatchesPlayed = 0,
                    MatchesWon = 0,
                    MatchesDrawn = 0,
                    Rank = 0
                });
            }
            else
            {
                var callerRank = await _leaderboardCache.TryGetCallerRankingAsync((int)format, userId, ct)
                    ?? await _ratingRepo.GetCallerRankingEntryAsync(userId, (int)format, ct);
                existing.Rank = callerRank?.Rank ?? 0;
            }
        }

        var response = new GetPlayerRatingsResponse();
        response.Ratings.AddRange(ratings.OrderBy(r => r.PlayFormat));
        return response;
    }

    public async Task<MatchDetail> GetMatchAsync(Guid matchId, CancellationToken ct = default)
    {
        var detail = await _matchRepo.GetMatchDetailAsync(matchId, ct);
        if (detail == null)
        {
            throw new NotFoundException($"Match '{matchId}' was not found.");
        }

        return detail;
    }

    private async Task EnrichMissingDisplayNamesAsync(
        List<RankingEntry> entries,
        RankingEntry? callerEntry,
        CancellationToken ct)
    {
        if (_userClient == null || entries.Count == 0)
        {
            return;
        }

        var missingUids = entries
            .Where(e => string.IsNullOrWhiteSpace(e.PlayerName) || string.Equals(e.PlayerName, e.UserId, StringComparison.Ordinal))
            .Select(e => e.UserId)
            .ToHashSet(StringComparer.Ordinal);

        if (callerEntry != null && (string.IsNullOrWhiteSpace(callerEntry.PlayerName) || string.Equals(callerEntry.PlayerName, callerEntry.UserId, StringComparison.Ordinal)))
        {
            missingUids.Add(callerEntry.UserId);
        }

        if (missingUids.Count == 0)
        {
            return;
        }

        try
        {
            var req = new GetProfilesRequest();
            req.FirebaseUids.AddRange(missingUids.Take(100));

            var resp = await _userClient.GetProfilesAsync(
                req,
                deadline: DateTime.UtcNow.AddSeconds(2),
                cancellationToken: ct);

            var nameMap = resp.Profiles.ToDictionary(p => p.FirebaseUid, p => p.DisplayName, StringComparer.Ordinal);
            foreach (var entry in entries)
            {
                if (nameMap.TryGetValue(entry.UserId, out var name) && !string.IsNullOrWhiteSpace(name))
                {
                    entry.PlayerName = name;
                }
            }

            if (callerEntry != null && nameMap.TryGetValue(callerEntry.UserId, out var callerName) && !string.IsNullOrWhiteSpace(callerName))
            {
                callerEntry.PlayerName = callerName;
            }
        }
        catch (RpcException ex)
        {
            _logger.LogDebug(ex, "Could not batch-enrich display names from User.Api");
        }
    }
}
