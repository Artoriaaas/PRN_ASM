namespace Multiplayer.Api.Domain.Runtime;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using Sudoku.Multi.V1;

public sealed class RedisLeaderboardCache : IRedisLeaderboardCache
{
    private sealed record PlayerRankingMeta(
        string DisplayName,
        int MatchesPlayed,
        int MatchesWon,
        int MatchesDrawn
    );

    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<RedisLeaderboardCache> _logger;

    public RedisLeaderboardCache(
        ILogger<RedisLeaderboardCache> logger,
        IConnectionMultiplexer? redis = null)
    {
        _logger = logger;
        _redis = redis;
    }

    public async Task UpsertPlayerRatingAsync(
        int playFormat,
        string userId,
        string displayName,
        int rating,
        int matchesPlayed,
        int matchesWon,
        int matchesDrawn,
        CancellationToken ct = default)
    {
        var db = GetDatabase();
        if (db == null || string.IsNullOrWhiteSpace(userId))
        {
            return;
        }

        try
        {
            int effectiveFormat = playFormat <= 0 ? (int)PlayFormat.Race : playFormat;
            var metaJson = JsonSerializer.Serialize(new PlayerRankingMeta(
                displayName,
                matchesPlayed,
                matchesWon,
                matchesDrawn
            ));

            // Composite score: rating as integer part + tie-breaker on wins in fractional part
            double compositeScore = rating + Math.Min(matchesWon, 99999) * 0.00001;

            var batch = db.CreateBatch();
            var t1 = batch.SortedSetAddAsync(GetZSetKey(effectiveFormat), userId, compositeScore);
            var t2 = batch.HashSetAsync(GetMetaHashKey(effectiveFormat), userId, metaJson);
            batch.Execute();

            await Task.WhenAll(t1, t2);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to update Redis Elo leaderboard for user {UserId}", userId);
        }
    }

    public async Task<List<RankingEntry>?> TryGetTopRankingsAsync(int playFormat, int limit, CancellationToken ct = default)
    {
        var db = GetDatabase();
        if (db == null)
        {
            return null;
        }

        try
        {
            int effectiveFormat = playFormat <= 0 ? (int)PlayFormat.Race : playFormat;
            int safeLimit = Math.Clamp(limit <= 0 ? 50 : limit, 1, 100);

            var zsetEntries = await db.SortedSetRangeByRankWithScoresAsync(
                GetZSetKey(effectiveFormat),
                start: 0,
                stop: safeLimit - 1,
                order: Order.Descending
            );

            if (zsetEntries.Length == 0)
            {
                return null;
            }

            var userIds = new RedisValue[zsetEntries.Length];
            for (int i = 0; i < zsetEntries.Length; i++)
            {
                userIds[i] = zsetEntries[i].Element;
            }

            var metaValues = await db.HashGetAsync(GetMetaHashKey(effectiveFormat), userIds);
            var result = new List<RankingEntry>(zsetEntries.Length);

            for (int i = 0; i < zsetEntries.Length; i++)
            {
                string userId = zsetEntries[i].Element.ToString();
                int rating = (int)Math.Floor(zsetEntries[i].Score);

                var meta = ParseMeta(metaValues[i], userId);
                result.Add(new RankingEntry
                {
                    Rank = i + 1,
                    UserId = userId,
                    PlayerName = meta.DisplayName,
                    Rating = rating,
                    PlayFormat = (PlayFormat)effectiveFormat,
                    MatchesPlayed = meta.MatchesPlayed,
                    MatchesWon = meta.MatchesWon,
                    MatchesDrawn = meta.MatchesDrawn
                });
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read top rankings from Redis for format {PlayFormat}", playFormat);
            return null;
        }
    }

    public async Task<RankingEntry?> TryGetCallerRankingAsync(int playFormat, string userId, CancellationToken ct = default)
    {
        var db = GetDatabase();
        if (db == null || string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        try
        {
            int effectiveFormat = playFormat <= 0 ? (int)PlayFormat.Race : playFormat;
            string zsetKey = GetZSetKey(effectiveFormat);

            var rankTask = db.SortedSetRankAsync(zsetKey, userId, Order.Descending);
            var scoreTask = db.SortedSetScoreAsync(zsetKey, userId);
            var metaTask = db.HashGetAsync(GetMetaHashKey(effectiveFormat), userId);

            await Task.WhenAll(rankTask, scoreTask, metaTask);

            long? rankZeroBased = rankTask.Result;
            double? score = scoreTask.Result;
            if (!rankZeroBased.HasValue || !score.HasValue)
            {
                return null;
            }

            var meta = ParseMeta(metaTask.Result, userId);
            return new RankingEntry
            {
                Rank = (int)rankZeroBased.Value + 1,
                UserId = userId,
                PlayerName = meta.DisplayName,
                Rating = (int)Math.Floor(score.Value),
                PlayFormat = (PlayFormat)effectiveFormat,
                MatchesPlayed = meta.MatchesPlayed,
                MatchesWon = meta.MatchesWon,
                MatchesDrawn = meta.MatchesDrawn
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read caller ranking from Redis for user {UserId}", userId);
            return null;
        }
    }

    private static PlayerRankingMeta ParseMeta(RedisValue value, string fallbackUserId)
    {
        if (!value.IsNullOrEmpty)
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<PlayerRankingMeta>(value!);
                if (parsed != null)
                {
                    return parsed;
                }
            }
            catch
            {
                // Ignore malformed cache metadata
            }
        }

        return new PlayerRankingMeta(fallbackUserId, 0, 0, 0);
    }

    private IDatabase? GetDatabase()
    {
        if (_redis == null || !_redis.IsConnected)
        {
            return null;
        }

        return _redis.GetDatabase();
    }

    private static string GetZSetKey(int playFormat) => $"leaderboard:elo:{playFormat}";
    private static string GetMetaHashKey(int playFormat) => $"leaderboard:meta:{playFormat}";
}
