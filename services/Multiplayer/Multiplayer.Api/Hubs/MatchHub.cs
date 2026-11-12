namespace Multiplayer.Api.Hubs;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Multiplayer.Api.Domain.Runtime;
using Multiplayer.Api.Domain.Services;
using Sudoku.Multi.V1;

public sealed class JoinQueueDto
{
    public int Format { get; set; }
    public int PlayFormat { get; set; }
    public int Layout { get; set; }
    public int BoardLayout { get; set; }
    public string? Level { get; set; }
    public string? LevelId { get; set; }

    public int EffectiveFormat => PlayFormat > 0 ? PlayFormat : (Format > 0 ? Format : (int)Sudoku.Multi.V1.PlayFormat.Race);
    public int EffectiveLayout => BoardLayout > 0 ? BoardLayout : (Layout > 0 ? Layout : (int)BoardLayoutType.Standard);
    public string EffectiveLevel => !string.IsNullOrWhiteSpace(LevelId) ? LevelId! : (!string.IsNullOrWhiteSpace(Level) ? Level! : "auto");
}

public sealed class CreateCustomRoomDto
{
    public int Format { get; set; }
    public int PlayFormat { get; set; }
    public int Layout { get; set; }
    public int BoardLayout { get; set; }
    public string? Level { get; set; }
    public string? LevelId { get; set; }

    public int EffectiveFormat => PlayFormat > 0 ? PlayFormat : (Format > 0 ? Format : (int)Sudoku.Multi.V1.PlayFormat.Race);
    public int EffectiveLayout => BoardLayout > 0 ? BoardLayout : (Layout > 0 ? Layout : (int)BoardLayoutType.Standard);
    public string EffectiveLevel => !string.IsNullOrWhiteSpace(LevelId) ? LevelId! : (!string.IsNullOrWhiteSpace(Level) ? Level! : "medium");
}

public sealed class JoinCustomRoomDto
{
    public string RoomCode { get; set; } = string.Empty;
}

public sealed class LeaveCustomRoomDto
{
    public string? RoomCode { get; set; }
}

public sealed class SubmitMoveDto
{
    public string MatchId { get; set; } = string.Empty;
    public int? I { get; set; }
    public int? CellIndex { get; set; }
    public int? V { get; set; }
    public int? Value { get; set; }
    public int? Turn { get; set; }
    public int? TurnNumber { get; set; }

    public int EffectiveCellIndex => CellIndex ?? I ?? -1;
    public int EffectiveValue => Value ?? V ?? -1;
    public int EffectiveTurnNumber => TurnNumber ?? Turn ?? 0;
}

public sealed class SaveMatchNotesDto
{
    public string MatchId { get; set; } = string.Empty;
    public Dictionary<int, int> Notes { get; set; } = new();
}

public sealed class MatchActionDto
{
    public string MatchId { get; set; } = string.Empty;
}

[Authorize]
public sealed class MatchHub : Hub
{
    private readonly IMatchmakingService _matchmaking;
    private readonly IMatchEngineService _matchEngine;
    private readonly IMatchRuntimeStore _runtimeStore;

    public MatchHub(
        IMatchmakingService matchmaking,
        IMatchEngineService matchEngine,
        IMatchRuntimeStore runtimeStore)
    {
        _matchmaking = matchmaking;
        _matchEngine = matchEngine;
        _runtimeStore = runtimeStore;
    }

    public static string GetMatchGroupName(Guid matchId) => $"match:{matchId}";

    public async Task JoinQueue(JoinQueueDto request)
    {
        string userId = GetCallerUserId();
        string displayName = GetCallerDisplayName(userId);
        var ct = Context.ConnectionAborted;

        var (matched, session) = await _matchmaking.JoinQueueAsync(
            userId,
            displayName,
            Context.ConnectionId,
            request.EffectiveFormat,
            request.EffectiveLayout,
            request.EffectiveLevel,
            ct);

        if (!matched || session == null)
        {
            await Clients.Caller.SendAsync("QueueJoined", new
            {
                format = request.EffectiveFormat,
                layout = request.EffectiveLayout,
                level = request.EffectiveLevel,
                joinedAt = DateTime.UtcNow.ToString("O")
            }, ct);
            return;
        }

        string groupName = GetMatchGroupName(session.MatchId);
        if (!string.IsNullOrWhiteSpace(session.Player1.ConnectionId))
        {
            await Groups.AddToGroupAsync(session.Player1.ConnectionId, groupName, ct);
        }
        if (!string.IsNullOrWhiteSpace(session.Player2.ConnectionId))
        {
            await Groups.AddToGroupAsync(session.Player2.ConnectionId, groupName, ct);
        }

        var payload = BuildMatchStartedPayload(session);
        await Clients.Group(groupName).SendAsync("MatchFound", payload, ct);
        await Clients.Group(groupName).SendAsync("MatchStarted", payload, ct);
    }

    public async Task LeaveQueue()
    {
        string userId = GetCallerUserId();
        await _matchmaking.LeaveQueueAsync(userId, Context.ConnectionAborted);
        await Clients.Caller.SendAsync("QueueLeft", new { userId }, Context.ConnectionAborted);
    }

    public async Task CreateCustomRoom(CreateCustomRoomDto request)
    {
        string userId = GetCallerUserId();
        string displayName = GetCallerDisplayName(userId);
        var ct = Context.ConnectionAborted;

        var room = await _matchmaking.CreateCustomRoomAsync(
            userId,
            displayName,
            Context.ConnectionId,
            request.EffectiveFormat,
            request.EffectiveLayout,
            request.EffectiveLevel,
            ct);

        await Clients.Caller.SendAsync("CustomRoomCreated", new
        {
            roomCode = room.RoomCode,
            format = room.PlayFormat,
            layout = room.BoardLayout,
            level = room.LevelId,
            hostUserId = room.HostUserId,
            hostDisplayName = room.HostDisplayName,
            hostRating = room.HostRating,
            createdAt = room.CreatedAtUtc.ToString("O")
        }, ct);
    }

    public async Task JoinCustomRoom(JoinCustomRoomDto request)
    {
        string userId = GetCallerUserId();
        string displayName = GetCallerDisplayName(userId);
        var ct = Context.ConnectionAborted;

        var (room, session) = await _matchmaking.JoinCustomRoomAsync(
            request.RoomCode,
            userId,
            displayName,
            Context.ConnectionId,
            ct);

        string groupName = GetMatchGroupName(session.MatchId);
        if (!string.IsNullOrWhiteSpace(session.Player1.ConnectionId))
        {
            await Groups.AddToGroupAsync(session.Player1.ConnectionId, groupName, ct);
        }
        if (!string.IsNullOrWhiteSpace(session.Player2.ConnectionId))
        {
            await Groups.AddToGroupAsync(session.Player2.ConnectionId, groupName, ct);
        }

        var payload = BuildMatchStartedPayload(session, room.RoomCode);
        await Clients.Group(groupName).SendAsync("MatchFound", payload, ct);
        await Clients.Group(groupName).SendAsync("MatchStarted", payload, ct);
    }

    public async Task LeaveCustomRoom(LeaveCustomRoomDto? request = null)
    {
        string userId = GetCallerUserId();
        await _matchmaking.LeaveCustomRoomAsync(userId, request?.RoomCode, Context.ConnectionAborted);
        await Clients.Caller.SendAsync("CustomRoomLeft", new { userId, roomCode = request?.RoomCode }, Context.ConnectionAborted);
    }

    public async Task SubmitMove(SubmitMoveDto request)
    {
        string userId = GetCallerUserId();
        Guid matchId = ParseMatchId(request.MatchId);
        var ct = Context.ConnectionAborted;

        var outcome = await _matchEngine.SubmitMoveAsync(
            matchId,
            userId,
            request.EffectiveCellIndex,
            request.EffectiveValue,
            request.EffectiveTurnNumber,
            ct);

        string groupName = GetMatchGroupName(matchId);
        var session = await _runtimeStore.GetAsync(matchId, ct);

        if (session != null && session.PlayFormat == (int)PlayFormat.Duel ||
            (outcome.FinalSummary != null && outcome.FinalSummary.PlayFormat == (int)PlayFormat.Duel))
        {
            // In Duel: both players share the board, so broadcast MoveResult to the whole room
            await Clients.Group(groupName).SendAsync("MoveResult", new
            {
                matchId = outcome.MatchId.ToString(),
                userId = outcome.UserId,
                i = outcome.CellIndex,
                v = outcome.Value,
                ok = outcome.IsCorrect,
                isDuplicateWrong = outcome.IsDuplicateWrong,
                tier = outcome.DifficultyTier,
                points = outcome.PointsDelta,
                score = outcome.Score,
                lives = outcome.LivesRemaining,
                mistakes = outcome.MistakesCount,
                revealedWrongDigits = outcome.RevealedWrongDigitsAtCell
            }, ct);

            if (outcome.TurnChanged && !outcome.MatchEnded)
            {
                await Clients.Group(groupName).SendAsync("TurnChanged", new
                {
                    matchId = outcome.MatchId.ToString(),
                    userId = outcome.CurrentTurnUserId,
                    turn = outcome.TurnNumber,
                    deadline = outcome.TurnDeadlineUtc.ToString("O")
                }, ct);
            }
        }
        else
        {
            // In Race: send detailed MoveResult only to the caller, and OpponentProgress (% only) to the opponent
            await Clients.Caller.SendAsync("MoveResult", new
            {
                matchId = outcome.MatchId.ToString(),
                userId = outcome.UserId,
                i = outcome.CellIndex,
                v = outcome.Value,
                ok = outcome.IsCorrect,
                isDuplicateWrong = outcome.IsDuplicateWrong,
                tier = outcome.DifficultyTier,
                points = outcome.PointsDelta,
                score = outcome.Score,
                lives = outcome.LivesRemaining,
                mistakes = outcome.MistakesCount,
                penaltySec = outcome.PenaltySeconds,
                progressPercent = outcome.ProgressPercent
            }, ct);

            await Clients.OthersInGroup(groupName).SendAsync("OpponentProgress", new
            {
                matchId = outcome.MatchId.ToString(),
                userId = outcome.UserId,
                filled = outcome.CorrectCells,
                mistakes = outcome.MistakesCount,
                lives = outcome.LivesRemaining,
                penaltySec = outcome.PenaltySeconds,
                progressPercent = outcome.ProgressPercent
            }, ct);
        }

        if (outcome.MatchEnded && outcome.FinalSummary != null)
        {
            await Clients.Group(groupName).SendAsync(
                "MatchEnded",
                BuildMatchEndedPayload(outcome.FinalSummary),
                ct);
        }
    }

    public async Task SaveNotes(SaveMatchNotesDto request)
    {
        string userId = GetCallerUserId();
        Guid matchId = ParseMatchId(request.MatchId);
        await _matchEngine.SaveNotesAsync(matchId, userId, request.Notes, Context.ConnectionAborted);
    }

    public async Task Resign(MatchActionDto request)
    {
        string userId = GetCallerUserId();
        Guid matchId = ParseMatchId(request.MatchId);
        var ct = Context.ConnectionAborted;

        var summary = await _matchEngine.ResignAsync(matchId, userId, ct);
        string groupName = GetMatchGroupName(matchId);

        await Clients.Group(groupName).SendAsync("MatchEnded", BuildMatchEndedPayload(summary), ct);
    }

    public async Task SetPlayerReady(MatchActionDto request)
    {
        string userId = GetCallerUserId();
        Guid matchId = ParseMatchId(request.MatchId);
        var ct = Context.ConnectionAborted;

        var prepOutcome = await _matchEngine.SetPlayerReadyAsync(matchId, userId, ct);
        string groupName = GetMatchGroupName(matchId);

        var session = await _runtimeStore.GetAsync(matchId, ct);
        if (session != null)
        {
            await Clients.Group(groupName).SendAsync("PlayerReadyChanged", new
            {
                matchId = matchId.ToString(),
                userId,
                player1Ready = session.Player1Ready,
                player2Ready = session.Player2Ready
            }, ct);
        }

        if (prepOutcome != null)
        {
            await Clients.Group(groupName).SendAsync("PreparationEnded", new
            {
                matchId = prepOutcome.MatchId.ToString(),
                startedAt = prepOutcome.StartedAtUtc.ToString("O"),
                currentTurnUserId = prepOutcome.CurrentTurnUserId,
                turn = prepOutcome.TurnNumber,
                turnDeadline = prepOutcome.TurnDeadlineUtc.ToString("O")
            }, ct);
        }
    }

    public async Task SyncRoomState(MatchActionDto request)
    {
        string userId = GetCallerUserId();
        Guid matchId = ParseMatchId(request.MatchId);
        var ct = Context.ConnectionAborted;

        var session = await _runtimeStore.GetAsync(matchId, ct);
        if (session == null)
        {
            throw new HubException($"Active match '{matchId}' was not found or has already completed.");
        }

        string groupName = GetMatchGroupName(matchId);
        bool wasDisconnected = false;

        await session.Gate.WaitAsync(ct);
        try
        {
            var player = session.GetPlayer(userId)
                ?? throw new HubException("You are not a participant in this match.");
            var opponent = session.GetOpponent(userId);

            wasDisconnected = player.DisconnectedAtUtc.HasValue;
            player.ConnectionId = Context.ConnectionId;
            player.DisconnectedAtUtc = null;

            await _runtimeStore.SaveAsync(session, ct);
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName, ct);

            await Clients.Caller.SendAsync("RoomStateSynced", new
            {
                matchId = session.MatchId.ToString(),
                playFormat = session.PlayFormat,
                boardLayout = session.BoardLayout,
                levelId = session.LevelId,
                initial = session.InitialBoard,
                regionMap = session.RegionMap,
                myBoard = session.PlayFormat == (int)PlayFormat.Duel ? session.SharedBoard : player.CurrentBoard,
                notes = player.Notes,
                myLives = player.LivesRemaining,
                myMistakes = player.MistakesCount,
                myScore = player.Score,
                myPenaltySec = player.PenaltySeconds,
                myProgressPercent = player.ProgressPercent,
                opponent = new
                {
                    userId = opponent.UserId,
                    displayName = opponent.DisplayName,
                    lives = opponent.LivesRemaining,
                    mistakes = opponent.MistakesCount,
                    score = opponent.Score,
                    filled = opponent.CorrectCells,
                    progressPercent = opponent.ProgressPercent,
                    isDisconnected = opponent.DisconnectedAtUtc.HasValue
                },
                currentTurnUserId = session.CurrentTurnUserId,
                turn = session.TurnNumber,
                turnDeadline = session.TurnDeadlineUtc.ToString("O"),
                startedAt = session.StartedAtUtc.ToString("O"),
                matchDeadline = session.MatchDeadlineUtc.ToString("O"),
                revealedWrongDigits = session.RevealedWrongDigits,
                isPreparationPhase = session.IsPreparationPhase,
                preparationDeadline = session.PreparationDeadlineUtc.ToString("O"),
                player1Ready = session.Player1Ready,
                player2Ready = session.Player2Ready
            }, ct);
        }
        finally
        {
            session.Gate.Release();
        }

        if (wasDisconnected)
        {
            await Clients.OthersInGroup(groupName).SendAsync("OpponentReconnected", new
            {
                matchId = session.MatchId.ToString(),
                userId
            }, ct);
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        string? userId = Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst("user_id")?.Value;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            await _matchmaking.LeaveQueueAsync(userId);
            await _matchmaking.LeaveCustomRoomAsync(userId);
            var session = await _runtimeStore.GetByUserIdAsync(userId);
            if (session != null && !session.IsFinished)
            {
                DateTime disconnectDeadline = DateTime.UtcNow.AddSeconds(session.Rules.ReconnectGraceSeconds);
                await session.Gate.WaitAsync();
                try
                {
                    var player = session.GetPlayer(userId);
                    if (player != null && string.Equals(player.ConnectionId, Context.ConnectionId, StringComparison.Ordinal))
                    {
                        player.DisconnectedAtUtc = DateTime.UtcNow;
                        disconnectDeadline = player.DisconnectedAtUtc.Value.AddSeconds(session.Rules.ReconnectGraceSeconds);
                        await _runtimeStore.SaveAsync(session);
                    }
                }
                finally
                {
                    session.Gate.Release();
                }

                string groupName = GetMatchGroupName(session.MatchId);
                await Clients.OthersInGroup(groupName).SendAsync("OpponentDisconnected", new
                {
                    matchId = session.MatchId.ToString(),
                    userId,
                    graceSeconds = session.Rules.ReconnectGraceSeconds,
                    deadline = disconnectDeadline.ToString("O")
                });
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    public static object BuildMatchStartedPayload(ActiveMatchSession session, string? roomCode = null)
    {
        return new
        {
            matchId = session.MatchId.ToString(),
            roomCode = roomCode ?? string.Empty,
            playFormat = session.PlayFormat,
            boardLayout = session.BoardLayout,
            levelId = session.LevelId,
            initial = session.InitialBoard,
            regionMap = session.RegionMap,
            rules = new
            {
                lives = session.Rules.MaxLives,
                turnSeconds = session.Rules.TurnSeconds,
                wrongTimePenaltySeconds = session.Rules.WrongTimePenaltySeconds,
                matchTimeLimitSeconds = session.Rules.MatchTimeLimitSeconds,
                reconnectGraceSeconds = session.Rules.ReconnectGraceSeconds,
                countdownSeconds = session.Rules.CountdownSeconds,
                preparationSeconds = session.Rules.PreparationSeconds
            },
            isPreparationPhase = session.IsPreparationPhase,
            preparationDeadline = session.PreparationDeadlineUtc.ToString("O"),
            preparationSeconds = session.Rules.PreparationSeconds,
            player1Ready = session.Player1Ready,
            player2Ready = session.Player2Ready,
            startedAt = session.StartedAtUtc.ToString("O"),
            currentTurnUserId = session.CurrentTurnUserId,
            turn = session.TurnNumber,
            turnDeadline = session.TurnDeadlineUtc.ToString("O"),
            player1 = new
            {
                userId = session.Player1.UserId,
                displayName = session.Player1.DisplayName,
                rating = session.Player1.RatingBefore,
                turnOrder = session.Player1.TurnOrder,
                lives = session.Player1.LivesRemaining
            },
            player2 = new
            {
                userId = session.Player2.UserId,
                displayName = session.Player2.DisplayName,
                rating = session.Player2.RatingBefore,
                turnOrder = session.Player2.TurnOrder,
                lives = session.Player2.LivesRemaining
            }
        };
    }

    public static object BuildMatchEndedPayload(FinalizedMatchSummary summary)
    {
        return new
        {
            matchId = summary.MatchId.ToString(),
            playFormat = summary.PlayFormat,
            boardLayout = summary.BoardLayout,
            levelId = summary.LevelId,
            isDraw = summary.IsDraw,
            winnerUserId = summary.WinnerUserId ?? string.Empty,
            reason = summary.EndReason,
            durationMs = summary.DurationMs,
            player1 = new
            {
                result = summary.Player1Result,
                ratingBefore = summary.Player1RatingBefore,
                eloDelta = summary.Player1RatingDelta,
                newRating = summary.Player1NewRating,
                score = summary.Player1Score,
                lives = summary.Player1Lives,
                mistakes = summary.Player1Mistakes
            },
            player2 = new
            {
                result = summary.Player2Result,
                ratingBefore = summary.Player2RatingBefore,
                eloDelta = summary.Player2RatingDelta,
                newRating = summary.Player2NewRating,
                score = summary.Player2Score,
                lives = summary.Player2Lives,
                mistakes = summary.Player2Mistakes
            }
        };
    }

    private string GetCallerUserId()
    {
        var sub = Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst("user_id")?.Value;
        if (string.IsNullOrWhiteSpace(sub))
        {
            throw new HubException("User is not authenticated.");
        }
        return sub;
    }

    private string GetCallerDisplayName(string fallbackUid)
    {
        var name = Context.User?.FindFirst("name")?.Value
            ?? Context.User?.FindFirst("email")?.Value?.Split('@')[0];
        return string.IsNullOrWhiteSpace(name) ? $"Player-{fallbackUid[..Math.Min(6, fallbackUid.Length)]}" : name;
    }

    private static Guid ParseMatchId(string matchId)
    {
        if (!Guid.TryParse(matchId, out var parsed))
        {
            throw new HubException($"Invalid matchId '{matchId}'.");
        }
        return parsed;
    }
}
