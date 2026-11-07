namespace Multiplayer.Api.Tests;

using System;
using System.Linq;
using System.Numerics;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Multiplayer.Api.Data;
using Multiplayer.Api.Data.Repositories;
using Multiplayer.Api.Domain.Exceptions;
using Multiplayer.Api.Domain.Runtime;
using Multiplayer.Api.Domain.Services;
using Sudoku.Core;
using Sudoku.Multi.V1;
using Xunit;

public class MultiplayerEngineAndQueryTests
{
    private ServiceProvider BuildTestServiceProvider(string dbName)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<MultiplayerDbContext>(opt => opt.UseInMemoryDatabase(dbName));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IMatchRepository, MatchRepository>();
        services.AddScoped<IPlayerRatingRepository, PlayerRatingRepository>();
        services.AddScoped<IMultiplayerQueryService, MultiplayerQueryService>();

        services.AddSingleton<IMatchRuntimeStore>(
            _ => new RedisMatchRuntimeStore(NullLogger<RedisMatchRuntimeStore>.Instance, redis: null));
        services.AddSingleton<IRedisLeaderboardCache>(
            _ => new RedisLeaderboardCache(NullLogger<RedisLeaderboardCache>.Instance, redis: null));
        services.AddSingleton<IMatchFinalizerService, MatchFinalizerService>();
        services.AddSingleton<IMatchEngineService, MatchEngineService>();
        services.AddSingleton<IMatchmakingService>(sp => new MatchmakingService(
            sp.GetRequiredService<IServiceScopeFactory>(),
            sp.GetRequiredService<IMatchRuntimeStore>(),
            NullLogger<MatchmakingService>.Instance));

        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task RaceMode_Matchmaking_WrongMovesAndThreeMistakes_EndsMatch_UpdatesEloAndOutbox()
    {
        using var sp = BuildTestServiceProvider(nameof(RaceMode_Matchmaking_WrongMovesAndThreeMistakes_EndsMatch_UpdatesEloAndOutbox));
        var matchmaking = sp.GetRequiredService<IMatchmakingService>();
        var engine = sp.GetRequiredService<IMatchEngineService>();

        // 1. Player A joins queue -> waiting
        var (matched1, session1) = await matchmaking.JoinQueueAsync(
            "user-race-1", "Alice", "conn-1", (int)PlayFormat.Race, (int)BoardLayoutType.Standard, "easy");
        Assert.False(matched1);
        Assert.Null(session1);

        // 2. Player B joins queue -> matched!
        var (matched2, session) = await matchmaking.JoinQueueAsync(
            "user-race-2", "Bob", "conn-2", (int)PlayFormat.Race, (int)BoardLayoutType.Standard, "easy");
        Assert.True(matched2);
        Assert.NotNull(session);

        var p1 = session!.Player1;
        var p2 = session.Player2;

        // Find first empty cell and its true solution digit
        int emptyIdx = session.InitialBoard.IndexOf(BoardConstants.EmptyCellChar);
        Assert.True(emptyIdx >= 0);
        int correctDigit = session.SolutionBoard[emptyIdx] - '0';
        int wrong1 = correctDigit == 1 ? 2 : 1;
        int wrong2 = (wrong1 % 9) + 1 == correctDigit ? ((wrong1 + 1) % 9) + 1 : (wrong1 % 9) + 1;
        int wrong3 = 1;
        while (wrong3 == correctDigit || wrong3 == wrong1 || wrong3 == wrong2) wrong3++;

        // 3. First wrong move: loses 1 life and +10s penalty
        var move1 = await engine.SubmitMoveAsync(session.MatchId, p1.UserId, emptyIdx, wrong1, turnNumber: 0);
        Assert.False(move1.IsCorrect);
        Assert.False(move1.IsDuplicateWrong);
        Assert.Equal(2, move1.LivesRemaining);
        Assert.Equal(10, move1.PenaltySeconds);

        // 4. Duplicate wrong move on same cell with same wrong digit: NO extra life lost or penalty added
        var moveDup = await engine.SubmitMoveAsync(session.MatchId, p1.UserId, emptyIdx, wrong1, turnNumber: 0);
        Assert.False(moveDup.IsCorrect);
        Assert.True(moveDup.IsDuplicateWrong);
        Assert.Equal(2, moveDup.LivesRemaining);
        Assert.Equal(10, moveDup.PenaltySeconds);

        // 5. Two more distinct wrong moves -> out of lives -> p2 wins!
        await engine.SubmitMoveAsync(session.MatchId, p1.UserId, emptyIdx, wrong2, turnNumber: 0);
        var finalMove = await engine.SubmitMoveAsync(session.MatchId, p1.UserId, emptyIdx, wrong3, turnNumber: 0);

        Assert.True(finalMove.MatchEnded);
        Assert.NotNull(finalMove.FinalSummary);
        Assert.Equal(p2.UserId, finalMove.FinalSummary!.WinnerUserId);
        Assert.Equal("opponent_out_of_lives", finalMove.FinalSummary.EndReason);

        // 6. Verify cold-path persistence (Ratings, MatchHistory, MatchDetail, OutboxMessage)
        using var scope = sp.CreateScope();
        var queryService = scope.ServiceProvider.GetRequiredService<IMultiplayerQueryService>();
        var db = scope.ServiceProvider.GetRequiredService<MultiplayerDbContext>();

        var rankings = await queryService.GetRankingsAsync(p2.UserId, (int)PlayFormat.Race, 10);
        Assert.Equal(2, rankings.Rankings.Count);
        Assert.Equal(p2.UserId, rankings.Rankings[0].UserId);
        Assert.True(rankings.Rankings[0].Rating > 1000);

        var p2History = await queryService.GetMatchHistoryAsync(p2.UserId, (int)PlayFormat.Race, 10);
        Assert.Single(p2History.Matches);
        Assert.True(p2History.Matches[0].IsWin);
        Assert.Equal(p1.DisplayName, p2History.Matches[0].OpponentName);

        var matchDetail = await queryService.GetMatchAsync(session.MatchId);
        Assert.Equal(MatchStatus.Completed, matchDetail.Status);
        Assert.Equal(2, matchDetail.Players.Count);

        Assert.Contains(db.OutboxMessages, m => m.Type == "MatchCompleted");
    }

    [Fact]
    public async Task DuelMode_TurnEnforcement_DynamicScoring8xCandidates_RevealedWrongDigits_AndTurnTimeout()
    {
        using var sp = BuildTestServiceProvider(nameof(DuelMode_TurnEnforcement_DynamicScoring8xCandidates_RevealedWrongDigits_AndTurnTimeout));
        var matchmaking = sp.GetRequiredService<IMatchmakingService>();
        var engine = sp.GetRequiredService<IMatchEngineService>();

        await matchmaking.JoinQueueAsync("duel-u1", "PlayerOne", "c1", (int)PlayFormat.Duel, (int)BoardLayoutType.Standard, "hard");
        var (_, session) = await matchmaking.JoinQueueAsync("duel-u2", "PlayerTwo", "c2", (int)PlayFormat.Duel, (int)BoardLayoutType.Standard, "hard");
        Assert.NotNull(session);

        // Duel puzzle must have an even number of empty cells
        int emptyCells = session!.InitialBoard.Count(c => c == BoardConstants.EmptyCellChar);
        Assert.Equal(0, emptyCells % 2);

        string activeUserId = session.CurrentTurnUserId;
        string waitingUserId = session.GetOpponent(activeUserId).UserId;

        // 1. Out-of-turn player cannot move
        int firstEmptyIdx = session.SharedBoard.IndexOf(BoardConstants.EmptyCellChar);
        int correctVal = session.SolutionBoard[firstEmptyIdx] - '0';
        await Assert.ThrowsAsync<InvalidStateException>(() =>
            engine.SubmitMoveAsync(session.MatchId, waitingUserId, firstEmptyIdx, correctVal, turnNumber: 1));

        // 2. Find an empty cell that evaluates to Advanced tier (if any) or verify points formula
        var regions = new RegionMap(session.RegionMap);
        var board = new SudokuBoard(session.SharedBoard, regions);
        int chosenIdx = firstEmptyIdx;
        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            if (session.SharedBoard[i] != BoardConstants.EmptyCellChar) continue;
            int val = session.SolutionBoard[i] - '0';
            var eval = MoveEvaluator.Evaluate(session.InitialBoard, session.SharedBoard, session.SolutionBoard, regions, CellCoord.ToRow(i), CellCoord.ToCol(i), val);
            if (eval.Tier == EvaluatedDifficultyTier.Advanced)
            {
                int candidates = BitOperations.PopCount(board.GetCandidatesMask(i));
                Assert.Equal(8 * candidates, eval.PointsDelta);
                chosenIdx = i;
                break;
            }
        }

        int chosenCorrectVal = session.SolutionBoard[chosenIdx] - '0';
        var okOutcome = await engine.SubmitMoveAsync(session.MatchId, activeUserId, chosenIdx, chosenCorrectVal, turnNumber: 1);
        Assert.True(okOutcome.IsCorrect);
        Assert.True(okOutcome.TurnChanged);
        Assert.Equal(waitingUserId, okOutcome.CurrentTurnUserId);
        Assert.Equal(2, okOutcome.TurnNumber);

        // 3. Second player makes a wrong move on another empty cell -> revealedWrongDigits populated, turn passes back
        int secondEmptyIdx = session.SharedBoard.IndexOf(BoardConstants.EmptyCellChar);
        int secondCorrectVal = session.SolutionBoard[secondEmptyIdx] - '0';
        int wrongVal = secondCorrectVal == 9 ? 1 : secondCorrectVal + 1;

        var wrongOutcome = await engine.SubmitMoveAsync(session.MatchId, waitingUserId, secondEmptyIdx, wrongVal, turnNumber: 2);
        Assert.False(wrongOutcome.IsCorrect);
        Assert.Contains(wrongVal, wrongOutcome.RevealedWrongDigitsAtCell);
        Assert.Equal(activeUserId, wrongOutcome.CurrentTurnUserId);
        Assert.Equal(3, wrongOutcome.TurnNumber);

        // 4. Simulate 15s turn timeout expiration
        var futureUtc = session.TurnDeadlineUtc.AddSeconds(5);
        var timeoutOutcome = await engine.CheckAndApplyDuelTurnTimeoutAsync(session, futureUtc);
        Assert.NotNull(timeoutOutcome);
        Assert.Equal(activeUserId, timeoutOutcome!.TimedOutUserId);
        Assert.Equal(2, timeoutOutcome.LivesRemaining);
        Assert.Equal(waitingUserId, timeoutOutcome.NextTurnUserId);
        Assert.Equal(4, timeoutOutcome.NextTurnNumber);
    }

    [Fact]
    public async Task CustomRoom_CreateAndJoinWith6CharCode_AndEloBasedLevelResolution()
    {
        using var sp = BuildTestServiceProvider(nameof(CustomRoom_CreateAndJoinWith6CharCode_AndEloBasedLevelResolution));
        var matchmaking = sp.GetRequiredService<IMatchmakingService>();

        Assert.Equal("easy", MatchmakingService.ResolveLevelFromElo(1000));
        Assert.Equal("medium", MatchmakingService.ResolveLevelFromElo(1150));
        Assert.Equal("hard", MatchmakingService.ResolveLevelFromElo(1350));
        Assert.Equal("expert", MatchmakingService.ResolveLevelFromElo(1550));

        var room = await matchmaking.CreateCustomRoomAsync(
            "host-1", "HostPlayer", "conn-host", (int)PlayFormat.Duel, (int)BoardLayoutType.Standard, "easy");

        Assert.Equal(6, room.RoomCode.Length);
        Assert.Equal("easy", room.LevelId);
        Assert.Equal((int)PlayFormat.Duel, room.PlayFormat);

        var (joinedRoom, session) = await matchmaking.JoinCustomRoomAsync(
            room.RoomCode.ToLowerInvariant(), "guest-1", "GuestPlayer", "conn-guest");

        Assert.Equal(room.RoomCode, joinedRoom.RoomCode);
        Assert.NotNull(session);
        Assert.Equal((int)PlayFormat.Duel, session.PlayFormat);
        Assert.Equal((int)BoardLayoutType.Standard, session.BoardLayout);
        Assert.Equal("easy", session.LevelId);
        Assert.Equal(5, session.Rules.CountdownSeconds);
    }
}
