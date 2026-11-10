namespace Multiplayer.Api.Domain.Runtime;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

public sealed class RedisMatchRuntimeStore : IMatchRuntimeStore
{
    private static readonly TimeSpan RoomTtl = TimeSpan.FromHours(2);

    private readonly ConcurrentDictionary<Guid, ActiveMatchSession> _sessions = new();
    private readonly ConcurrentDictionary<string, Guid> _userActiveMatch = new(StringComparer.Ordinal);
    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<RedisMatchRuntimeStore> _logger;

    public RedisMatchRuntimeStore(
        ILogger<RedisMatchRuntimeStore> logger,
        IConnectionMultiplexer? redis = null)
    {
        _logger = logger;
        _redis = redis;
    }

    public IReadOnlyCollection<ActiveMatchSession> GetAllActiveInMemory()
    {
        return _sessions.Values.Where(s => !s.IsFinished).ToArray();
    }

    public async Task<ActiveMatchSession?> GetAsync(Guid matchId, CancellationToken ct = default)
    {
        if (_sessions.TryGetValue(matchId, out var inMemory))
        {
            return inMemory;
        }

        var db = GetDatabase();
        if (db == null)
        {
            return null;
        }

        try
        {
            var raw = await db.StringGetAsync(GetRoomKey(matchId));
            if (raw.IsNullOrEmpty)
            {
                return null;
            }

            var restored = JsonSerializer.Deserialize<ActiveMatchSession>(raw!);
            if (restored == null || restored.IsFinished)
            {
                return null;
            }

            var canonical = _sessions.GetOrAdd(matchId, restored);
            _userActiveMatch[canonical.Player1.UserId] = matchId;
            _userActiveMatch[canonical.Player2.UserId] = matchId;
            return canonical;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to restore match {MatchId} from Redis", matchId);
            return null;
        }
    }

    public async Task<ActiveMatchSession?> GetByUserIdAsync(string userId, CancellationToken ct = default)
    {
        if (_userActiveMatch.TryGetValue(userId, out var matchId))
        {
            var session = await GetAsync(matchId, ct);
            if (session != null && !session.IsFinished)
            {
                return session;
            }
        }

        var db = GetDatabase();
        if (db == null)
        {
            return null;
        }

        try
        {
            var rawMatchId = await db.StringGetAsync(GetUserMatchKey(userId));
            if (!rawMatchId.IsNullOrEmpty && Guid.TryParse(rawMatchId!, out var parsedMatchId))
            {
                return await GetAsync(parsedMatchId, ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read user active match mapping from Redis for {UserId}", userId);
        }

        return null;
    }

    public async Task SaveAsync(ActiveMatchSession session, CancellationToken ct = default)
    {
        _sessions[session.MatchId] = session;
        _userActiveMatch[session.Player1.UserId] = session.MatchId;
        _userActiveMatch[session.Player2.UserId] = session.MatchId;

        var db = GetDatabase();
        if (db == null)
        {
            return;
        }

        try
        {
            string json = JsonSerializer.Serialize(session);
            string matchIdStr = session.MatchId.ToString();

            var batch = db.CreateBatch();
            var t1 = batch.StringSetAsync(GetRoomKey(session.MatchId), json, RoomTtl);
            var t2 = batch.StringSetAsync(GetUserMatchKey(session.Player1.UserId), matchIdStr, RoomTtl);
            var t3 = batch.StringSetAsync(GetUserMatchKey(session.Player2.UserId), matchIdStr, RoomTtl);
            batch.Execute();

            await Task.WhenAll(t1, t2, t3);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to mirror match {MatchId} snapshot to Redis", session.MatchId);
        }
    }

    public async Task RemoveAsync(Guid matchId, string player1UserId, string player2UserId, CancellationToken ct = default)
    {
        _sessions.TryRemove(matchId, out _);
        _userActiveMatch.TryRemove(player1UserId, out _);
        _userActiveMatch.TryRemove(player2UserId, out _);

        var db = GetDatabase();
        if (db == null)
        {
            return;
        }

        try
        {
            await db.KeyDeleteAsync(new RedisKey[]
            {
                GetRoomKey(matchId),
                GetUserMatchKey(player1UserId),
                GetUserMatchKey(player2UserId)
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete match {MatchId} keys from Redis", matchId);
        }
    }

    private IDatabase? GetDatabase()
    {
        if (_redis == null || !_redis.IsConnected)
        {
            return null;
        }

        return _redis.GetDatabase();
    }

    private static string GetRoomKey(Guid matchId) => $"match:room:session:{matchId}";
    private static string GetUserMatchKey(string userId) => $"match:user:active:{userId}";
}
