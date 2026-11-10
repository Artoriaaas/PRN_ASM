namespace Multiplayer.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using global::Grpc.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Multiplayer.Api.Domain.Entities;
using Multiplayer.Api.Domain.Runtime;
using Multiplayer.Api.Domain.ValueObjects;
using Sudoku.Core;
using Sudoku.Game.V1;
using Sudoku.Multi.V1;
using Sudoku.User.V1;

public sealed record QueueTicket(
    string UserId,
    string DisplayName,
    string ConnectionId,
    int PlayFormat,
    int BoardLayout,
    string LevelId,
    int Rating,
    DateTime JoinedAtUtc
);

public sealed record CustomRoomInfo(
    string RoomCode,
    string HostUserId,
    string HostDisplayName,
    string HostConnectionId,
    int HostRating,
    int PlayFormat,
    int BoardLayout,
    string LevelId,
    DateTime CreatedAtUtc
);

public interface IMatchmakingService
{
    Task<(bool Matched, ActiveMatchSession? Session)> JoinQueueAsync(
        string userId,
        string fallbackDisplayName,
        string connectionId,
        int playFormat,
        int boardLayout,
        string levelId,
        CancellationToken ct = default);

    Task LeaveQueueAsync(string userId, CancellationToken ct = default);

    Task<CustomRoomInfo> CreateCustomRoomAsync(
        string hostUserId,
        string fallbackDisplayName,
        string connectionId,
        int playFormat,
        int boardLayout,
        string levelId,
        CancellationToken ct = default);

    Task<(CustomRoomInfo Room, ActiveMatchSession Session)> JoinCustomRoomAsync(
        string roomCode,
        string guestUserId,
        string fallbackDisplayName,
        string connectionId,
        CancellationToken ct = default);

    Task LeaveCustomRoomAsync(string userId, string? roomCode = null, CancellationToken ct = default);
}

public sealed class MatchmakingService : IMatchmakingService
{
    private static readonly Dictionary<string, int> LevelOrder = new(StringComparer.OrdinalIgnoreCase)
    {
        ["easy"] = 1,
        ["medium"] = 2,
        ["hard"] = 3,
        ["expert"] = 4
    };

    private static readonly char[] RoomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();

    private readonly SemaphoreSlim _queueLock = new(1, 1);
    private readonly List<QueueTicket> _waiting = new();
    private readonly Dictionary<string, CustomRoomInfo> _customRooms = new(StringComparer.OrdinalIgnoreCase);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMatchRuntimeStore _runtimeStore;
    private readonly GameService.GameServiceClient? _gameClient;
    private readonly UserService.UserServiceClient? _userClient;
    private readonly ILogger<MatchmakingService> _logger;

    public MatchmakingService(
        IServiceScopeFactory scopeFactory,
        IMatchRuntimeStore runtimeStore,
        ILogger<MatchmakingService> logger,
        GameService.GameServiceClient? gameClient = null,
        UserService.UserServiceClient? userClient = null)
    {
        _scopeFactory = scopeFactory;
        _runtimeStore = runtimeStore;
        _logger = logger;
        _gameClient = gameClient;
        _userClient = userClient;
    }

    public async Task<(bool Matched, ActiveMatchSession? Session)> JoinQueueAsync(
        string userId,
        string fallbackDisplayName,
        string connectionId,
        int playFormat,
        int boardLayout,
        string levelId,
        CancellationToken ct = default)
    {
        int effectiveFormat = playFormat == (int)PlayFormat.Duel ? (int)PlayFormat.Duel : (int)PlayFormat.Race;
        int effectiveLayout = boardLayout == (int)BoardLayoutType.Irregular ? (int)BoardLayoutType.Irregular : (int)BoardLayoutType.Standard;
        // If user already has an active match, return it
        var existingMatch = await _runtimeStore.GetByUserIdAsync(userId, ct);
        if (existingMatch != null && !existingMatch.IsFinished)
        {
            var participant = existingMatch.GetPlayer(userId);
            if (participant != null)
            {
                participant.ConnectionId = connectionId;
                participant.DisconnectedAtUtc = null;
                await _runtimeStore.SaveAsync(existingMatch, ct);
            }
            return (true, existingMatch);
        }

        var (rating, resolvedName) = await ResolvePlayerRatingAndNameAsync(userId, fallbackDisplayName, effectiveFormat, ct);
        string effectiveLevel = ResolveEffectiveLevelId(levelId, rating);
        var ticket = new QueueTicket(
            UserId: userId,
            DisplayName: resolvedName,
            ConnectionId: connectionId,
            PlayFormat: effectiveFormat,
            BoardLayout: effectiveLayout,
            LevelId: effectiveLevel,
            Rating: rating,
            JoinedAtUtc: DateTime.UtcNow
        );

        QueueTicket? opponentTicket = null;

        await _queueLock.WaitAsync(ct);
        try
        {
            _waiting.RemoveAll(x => string.Equals(x.UserId, userId, StringComparison.Ordinal));

            // Find closest-rated waiting opponent with the same format & layout
            opponentTicket = _waiting
                .Where(x => x.PlayFormat == effectiveFormat && x.BoardLayout == effectiveLayout)
                .OrderBy(x => Math.Abs(x.Rating - ticket.Rating))
                .ThenBy(x => x.JoinedAtUtc)
                .FirstOrDefault();

            if (opponentTicket != null)
            {
                _waiting.Remove(opponentTicket);
            }
            else
            {
                _waiting.Add(ticket);
                return (false, null);
            }
        }
        finally
        {
            _queueLock.Release();
        }

        var session = await CreateMatchSessionAsync(opponentTicket, ticket, ct);
        return (true, session);
    }

    public async Task LeaveQueueAsync(string userId, CancellationToken ct = default)
    {
        await _queueLock.WaitAsync(ct);
        try
        {
            _waiting.RemoveAll(x => string.Equals(x.UserId, userId, StringComparison.Ordinal));
        }
        finally
        {
            _queueLock.Release();
        }
    }

    public async Task<CustomRoomInfo> CreateCustomRoomAsync(
        string hostUserId,
        string fallbackDisplayName,
        string connectionId,
        int playFormat,
        int boardLayout,
        string levelId,
        CancellationToken ct = default)
    {
        int effectiveFormat = playFormat == (int)PlayFormat.Duel ? (int)PlayFormat.Duel : (int)PlayFormat.Race;
        int effectiveLayout = boardLayout == (int)BoardLayoutType.Irregular ? (int)BoardLayoutType.Irregular : (int)BoardLayoutType.Standard;

        var (rating, resolvedName) = await ResolvePlayerRatingAndNameAsync(hostUserId, fallbackDisplayName, effectiveFormat, ct);
        string effectiveLevel = ResolveEffectiveLevelId(levelId, rating);

        await _queueLock.WaitAsync(ct);
        try
        {
            _waiting.RemoveAll(x => string.Equals(x.UserId, hostUserId, StringComparison.Ordinal));
            var staleCodes = _customRooms
                .Where(kv => string.Equals(kv.Value.HostUserId, hostUserId, StringComparison.Ordinal) ||
                             (DateTime.UtcNow - kv.Value.CreatedAtUtc).TotalMinutes > 30)
                .Select(kv => kv.Key)
                .ToList();
            foreach (var code in staleCodes)
            {
                _customRooms.Remove(code);
            }

            string roomCode = GenerateUniqueRoomCode();
            var roomInfo = new CustomRoomInfo(
                RoomCode: roomCode,
                HostUserId: hostUserId,
                HostDisplayName: resolvedName,
                HostConnectionId: connectionId,
                HostRating: rating,
                PlayFormat: effectiveFormat,
                BoardLayout: effectiveLayout,
                LevelId: effectiveLevel,
                CreatedAtUtc: DateTime.UtcNow
            );

            _customRooms[roomCode] = roomInfo;
            return roomInfo;
        }
        finally
        {
            _queueLock.Release();
        }
    }

    public async Task<(CustomRoomInfo Room, ActiveMatchSession Session)> JoinCustomRoomAsync(
        string roomCode,
        string guestUserId,
        string fallbackDisplayName,
        string connectionId,
        CancellationToken ct = default)
    {
        string normalizedCode = (roomCode ?? string.Empty).Trim().ToUpperInvariant();
        if (normalizedCode.Length != 6)
        {
            throw new Multiplayer.Api.Domain.Exceptions.ValidationException("Mã phòng phải gồm đúng 6 ký tự.");
        }

        CustomRoomInfo? room;
        await _queueLock.WaitAsync(ct);
        try
        {
            if (!_customRooms.TryGetValue(normalizedCode, out room))
            {
                throw new Multiplayer.Api.Domain.Exceptions.NotFoundException($"Phòng '{normalizedCode}' không tồn tại hoặc đã bắt đầu.");
            }

            if (string.Equals(room.HostUserId, guestUserId, StringComparison.Ordinal))
            {
                throw new Multiplayer.Api.Domain.Exceptions.ValidationException("Bạn đang là chủ phòng này.");
            }

            _customRooms.Remove(normalizedCode);
            _waiting.RemoveAll(x => string.Equals(x.UserId, guestUserId, StringComparison.Ordinal));
        }
        finally
        {
            _queueLock.Release();
        }

        var (guestRating, guestName) = await ResolvePlayerRatingAndNameAsync(guestUserId, fallbackDisplayName, room.PlayFormat, ct);

        var hostTicket = new QueueTicket(
            UserId: room.HostUserId,
            DisplayName: room.HostDisplayName,
            ConnectionId: room.HostConnectionId,
            PlayFormat: room.PlayFormat,
            BoardLayout: room.BoardLayout,
            LevelId: room.LevelId,
            Rating: room.HostRating,
            JoinedAtUtc: room.CreatedAtUtc
        );

        var guestTicket = new QueueTicket(
            UserId: guestUserId,
            DisplayName: guestName,
            ConnectionId: connectionId,
            PlayFormat: room.PlayFormat,
            BoardLayout: room.BoardLayout,
            LevelId: room.LevelId,
            Rating: guestRating,
            JoinedAtUtc: DateTime.UtcNow
        );

        var session = await CreateMatchSessionAsync(hostTicket, guestTicket, ct);
        return (room, session);
    }

    public async Task LeaveCustomRoomAsync(string userId, string? roomCode = null, CancellationToken ct = default)
    {
        await _queueLock.WaitAsync(ct);
        try
        {
            if (!string.IsNullOrWhiteSpace(roomCode))
            {
                string normalized = roomCode.Trim().ToUpperInvariant();
                if (_customRooms.TryGetValue(normalized, out var info) &&
                    string.Equals(info.HostUserId, userId, StringComparison.Ordinal))
                {
                    _customRooms.Remove(normalized);
                }
            }
            else
            {
                var codes = _customRooms
                    .Where(kv => string.Equals(kv.Value.HostUserId, userId, StringComparison.Ordinal))
                    .Select(kv => kv.Key)
                    .ToList();
                foreach (var code in codes)
                {
                    _customRooms.Remove(code);
                }
            }
        }
        finally
        {
            _queueLock.Release();
        }
    }

    public static string ResolveLevelFromElo(int rating) => rating switch
    {
        >= 1500 => "expert",
        >= 1300 => "hard",
        >= 1100 => "medium",
        _ => "easy"
    };

    private string GenerateUniqueRoomCode()
    {
        Span<char> chars = stackalloc char[6];
        for (int attempt = 0; attempt < 20; attempt++)
        {
            for (int i = 0; i < 6; i++)
            {
                chars[i] = RoomCodeAlphabet[Random.Shared.Next(RoomCodeAlphabet.Length)];
            }
            string candidate = new(chars);
            if (!_customRooms.ContainsKey(candidate))
            {
                return candidate;
            }
        }
        return Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
    }

    private static string ResolveEffectiveLevelId(string? requestedLevelId, int rating)
    {
        if (string.IsNullOrWhiteSpace(requestedLevelId))
        {
            return ResolveLevelFromElo(rating);
        }

        string normalized = requestedLevelId.Trim().ToLowerInvariant();
        if (normalized == "auto")
        {
            return ResolveLevelFromElo(rating);
        }

        return LevelOrder.ContainsKey(normalized) ? normalized : ResolveLevelFromElo(rating);
    }

    private async Task<ActiveMatchSession> CreateMatchSessionAsync(
        QueueTicket p1Ticket,
        QueueTicket p2Ticket,
        CancellationToken ct)
    {
        // Select level based on the lower-rated player (CORE-LOGIC.md §1.5)
        string chosenLevel = SelectMatchLevel(p1Ticket, p2Ticket);
        bool isDuel = p1Ticket.PlayFormat == (int)PlayFormat.Duel;

        var puzzleData = await AcquirePuzzleAsync(
            chosenLevel,
            p1Ticket.BoardLayout,
            requireEvenEmptyCells: isDuel,
            new[] { p1Ticket.UserId, p2Ticket.UserId },
            ct);

        int emptyCells = puzzleData.InitialBoard.Count(c => c == BoardConstants.EmptyCellChar);
        var rules = new MatchRules();
        var now = DateTime.UtcNow;
        var startedAt = now.AddSeconds(rules.CountdownSeconds);

        // Randomly pick who goes first in Duel (CORE-LOGIC.md §1.7)
        bool p1First = Random.Shared.Next(2) == 0;
        var firstTicket = p1First ? p1Ticket : p2Ticket;
        var secondTicket = p1First ? p2Ticket : p1Ticket;

        var matchId = Guid.NewGuid();
        var turnDeadline = startedAt.AddSeconds(rules.TurnSeconds);

        var session = new ActiveMatchSession
        {
            MatchId = matchId,
            PlayFormat = p1Ticket.PlayFormat,
            BoardLayout = p1Ticket.BoardLayout,
            LevelId = chosenLevel,
            PuzzleId = puzzleData.PuzzleId,
            InitialBoard = puzzleData.InitialBoard,
            SolutionBoard = puzzleData.SolutionBoard,
            RegionMap = puzzleData.RegionMap,
            Rules = rules,
            SharedBoard = puzzleData.InitialBoard,
            CurrentTurnUserId = firstTicket.UserId,
            TurnNumber = 1,
            TurnStartedAtUtc = startedAt,
            TurnDeadlineUtc = turnDeadline,
            CreatedAtUtc = now,
            StartedAtUtc = startedAt,
            MatchDeadlineUtc = startedAt.AddSeconds(rules.MatchTimeLimitSeconds),
            IsFinished = false,
            Player1 = new ActivePlayerRuntime
            {
                UserId = firstTicket.UserId,
                DisplayName = firstTicket.DisplayName,
                TurnOrder = 1,
                RatingBefore = firstTicket.Rating,
                CurrentBoard = puzzleData.InitialBoard,
                LivesRemaining = rules.MaxLives,
                TotalEmptyCells = emptyCells,
                ConnectionId = firstTicket.ConnectionId
            },
            Player2 = new ActivePlayerRuntime
            {
                UserId = secondTicket.UserId,
                DisplayName = secondTicket.DisplayName,
                TurnOrder = 2,
                RatingBefore = secondTicket.Rating,
                CurrentBoard = puzzleData.InitialBoard,
                LivesRemaining = rules.MaxLives,
                TotalEmptyCells = emptyCells,
                ConnectionId = secondTicket.ConnectionId
            }
        };

        // Persist initial Match & MatchPlayers snapshot in PostgreSQL (1 single SaveChangesAsync)
        using (var scope = _scopeFactory.CreateScope())
        {
            var matchRepo = scope.ServiceProvider.GetRequiredService<IMatchRepository>();
            var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var matchEntity = new Match
            {
                Id = matchId,
                PlayFormat = session.PlayFormat,
                BoardLayout = session.BoardLayout,
                LevelId = session.LevelId,
                PuzzleId = session.PuzzleId,
                InitialBoard = session.InitialBoard,
                SolutionBoard = session.SolutionBoard,
                RegionMap = session.RegionMap,
                Status = (int)MatchStatus.InProgress,
                SharedBoard = session.SharedBoard,
                CurrentTurnUserId = session.CurrentTurnUserId,
                TurnNumber = 1,
                TurnDeadline = session.TurnDeadlineUtc,
                StartedAt = session.StartedAtUtc
            };
            matchEntity.SetRules(rules);

            matchEntity.Players.Add(new MatchPlayer
            {
                Id = Guid.NewGuid(),
                MatchId = matchId,
                UserId = session.Player1.UserId,
                DisplayName = session.Player1.DisplayName,
                OpponentUserId = session.Player2.UserId,
                OpponentName = session.Player2.DisplayName,
                PlayFormat = session.PlayFormat,
                BoardLayout = session.BoardLayout,
                LevelId = session.LevelId,
                TurnOrder = 1,
                CurrentBoard = session.Player1.CurrentBoard,
                LivesRemaining = rules.MaxLives,
                RatingBefore = session.Player1.RatingBefore
            });

            matchEntity.Players.Add(new MatchPlayer
            {
                Id = Guid.NewGuid(),
                MatchId = matchId,
                UserId = session.Player2.UserId,
                DisplayName = session.Player2.DisplayName,
                OpponentUserId = session.Player1.UserId,
                OpponentName = session.Player1.DisplayName,
                PlayFormat = session.PlayFormat,
                BoardLayout = session.BoardLayout,
                LevelId = session.LevelId,
                TurnOrder = 2,
                CurrentBoard = session.Player2.CurrentBoard,
                LivesRemaining = rules.MaxLives,
                RatingBefore = session.Player2.RatingBefore
            });

            matchRepo.Add(matchEntity);
            await uow.SaveChangesAsync(ct);
        }

        await _runtimeStore.SaveAsync(session, ct);
        return session;
    }

    private async Task<(int Rating, string DisplayName)> ResolvePlayerRatingAndNameAsync(
        string userId,
        string fallbackDisplayName,
        int playFormat,
        CancellationToken ct)
    {
        int rating = PlayerRating.DefaultInitialRating;
        string displayName = string.IsNullOrWhiteSpace(fallbackDisplayName) ? $"Player-{userId[..Math.Min(6, userId.Length)]}" : fallbackDisplayName;

        using (var scope = _scopeFactory.CreateScope())
        {
            var ratingRepo = scope.ServiceProvider.GetRequiredService<IPlayerRatingRepository>();
            var existing = await ratingRepo.GetReadOnlyAsync(userId, playFormat, ct);
            if (existing != null)
            {
                rating = existing.Rating;
                if (!string.IsNullOrWhiteSpace(existing.DisplayName))
                {
                    displayName = existing.DisplayName;
                }
            }
        }

        if (_userClient != null)
        {
            try
            {
                var req = new GetProfilesRequest();
                req.FirebaseUids.Add(userId);
                var resp = await _userClient.GetProfilesAsync(
                    req,
                    deadline: DateTime.UtcNow.AddSeconds(2),
                    cancellationToken: ct);

                var profile = resp.Profiles.FirstOrDefault();
                if (profile != null && !string.IsNullOrWhiteSpace(profile.DisplayName))
                {
                    displayName = profile.DisplayName;
                }
            }
            catch (RpcException ex)
            {
                _logger.LogDebug(ex, "Could not fetch profile from User.Api for {UserId}; using fallback display name", userId);
            }
        }

        return (rating, displayName);
    }

    private async Task<(Guid PuzzleId, string InitialBoard, string SolutionBoard, string RegionMap)> AcquirePuzzleAsync(
        string levelId,
        int boardLayout,
        bool requireEvenEmptyCells,
        IReadOnlyList<string> excludeUserIds,
        CancellationToken ct)
    {
        if (_gameClient != null)
        {
            try
            {
                var req = new AcquirePuzzleForMatchRequest
                {
                    LevelId = levelId,
                    LayoutType = (LayoutType)boardLayout,
                    RequireEvenEmptyCells = requireEvenEmptyCells
                };
                req.ExcludeUserIds.AddRange(excludeUserIds);

                var resp = await _gameClient.AcquirePuzzleForMatchAsync(
                    req,
                    deadline: DateTime.UtcNow.AddSeconds(3),
                    cancellationToken: ct);

                Guid parsedId = Guid.TryParse(resp.PuzzleId, out var g) ? g : Guid.NewGuid();
                return (parsedId, resp.InitialBoard, resp.SolutionBoard, resp.RegionMap);
            }
            catch (RpcException ex)
            {
                _logger.LogWarning(ex, "Game.Api AcquirePuzzleForMatch failed; falling back to local Sudoku.Core generator");
            }
        }

        var (minClues, maxClues) = levelId switch
        {
            "expert" => (24, 27),
            "hard" => (28, 31),
            "medium" => (32, 36),
            _ => (38, 42)
        };

        var regionMap = RegionMap.GetForLayout(boardLayout);
        var generated = SudokuGenerator.Generate(regionMap, minClues, maxClues, requireEvenEmptyCells: requireEvenEmptyCells);
        return (Guid.NewGuid(), generated.InitialBoard, generated.SolutionBoard, generated.RegionMap);
    }

    private static string SelectMatchLevel(QueueTicket p1, QueueTicket p2)
    {
        var lowerRated = p1.Rating <= p2.Rating ? p1 : p2;
        int order1 = LevelOrder.GetValueOrDefault(p1.LevelId, 1);
        int order2 = LevelOrder.GetValueOrDefault(p2.LevelId, 1);
        int lowerOrder = Math.Min(order1, order2);

        if (order1 == order2)
        {
            return lowerRated.LevelId;
        }

        return LevelOrder.FirstOrDefault(kv => kv.Value == lowerOrder).Key ?? "easy";
    }

    private static string NormalizeLevelId(string? levelId)
    {
        if (string.IsNullOrWhiteSpace(levelId))
        {
            return "easy";
        }

        string normalized = levelId.Trim().ToLowerInvariant();
        return LevelOrder.ContainsKey(normalized) ? normalized : "easy";
    }
}
