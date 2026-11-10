namespace Multiplayer.Api.Domain.Services;

using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Google.Protobuf;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Multiplayer.Api.Domain.Entities;
using Multiplayer.Api.Domain.Runtime;
using Sudoku.Events.V1;
using Sudoku.Messaging;
using Sudoku.Multi.V1;

public sealed record FinalizedMatchSummary(
    Guid MatchId,
    int PlayFormat,
    int BoardLayout,
    string LevelId,
    bool IsDraw,
    string? WinnerUserId,
    string EndReason,
    long DurationMs,
    int Player1Result,
    int Player2Result,
    int Player1RatingBefore,
    int Player1RatingDelta,
    int Player1NewRating,
    int Player2RatingBefore,
    int Player2RatingDelta,
    int Player2NewRating,
    int Player1Score,
    int Player2Score,
    int Player1Lives,
    int Player2Lives,
    int Player1Mistakes,
    int Player2Mistakes
);

public interface IMatchFinalizerService
{
    Task<FinalizedMatchSummary> FinalizeMatchAsync(
        ActiveMatchSession session,
        string? winnerUserId,
        bool isDraw,
        string endReason,
        CancellationToken ct = default);
}

public sealed class MatchFinalizerService : IMatchFinalizerService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMatchRuntimeStore _runtimeStore;
    private readonly IRedisLeaderboardCache _leaderboardCache;
    private readonly ILogger<MatchFinalizerService> _logger;

    public MatchFinalizerService(
        IServiceScopeFactory scopeFactory,
        IMatchRuntimeStore runtimeStore,
        IRedisLeaderboardCache leaderboardCache,
        ILogger<MatchFinalizerService> logger)
    {
        _scopeFactory = scopeFactory;
        _runtimeStore = runtimeStore;
        _leaderboardCache = leaderboardCache;
        _logger = logger;
    }

    public async Task<FinalizedMatchSummary> FinalizeMatchAsync(
        ActiveMatchSession session,
        string? winnerUserId,
        bool isDraw,
        string endReason,
        CancellationToken ct = default)
    {
        session.IsFinished = true;
        var now = DateTime.UtcNow;
        long durationMs = Math.Max(0, (long)(now - session.StartedAtUtc).TotalMilliseconds);

        MatchResult p1Result;
        MatchResult p2Result;

        if (isDraw || string.IsNullOrWhiteSpace(winnerUserId))
        {
            isDraw = true;
            winnerUserId = null;
            p1Result = MatchResult.Draw;
            p2Result = MatchResult.Draw;
        }
        else if (string.Equals(winnerUserId, session.Player1.UserId, StringComparison.Ordinal))
        {
            p1Result = MatchResult.Win;
            p2Result = MatchResult.Loss;
        }
        else
        {
            p1Result = MatchResult.Loss;
            p2Result = MatchResult.Win;
        }

        using var scope = _scopeFactory.CreateScope();
        var matchRepo = scope.ServiceProvider.GetRequiredService<IMatchRepository>();
        var ratingRepo = scope.ServiceProvider.GetRequiredService<IPlayerRatingRepository>();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        // 1. Load or create PlayerRatings for both players on this PlayFormat
        var rating1 = await ratingRepo.GetForUpdateAsync(session.Player1.UserId, session.PlayFormat, ct);
        if (rating1 == null)
        {
            rating1 = new PlayerRating
            {
                UserId = session.Player1.UserId,
                PlayFormat = session.PlayFormat,
                DisplayName = session.Player1.DisplayName,
                Rating = session.Player1.RatingBefore > 0 ? session.Player1.RatingBefore : PlayerRating.DefaultInitialRating
            };
            ratingRepo.Add(rating1);
        }

        var rating2 = await ratingRepo.GetForUpdateAsync(session.Player2.UserId, session.PlayFormat, ct);
        if (rating2 == null)
        {
            rating2 = new PlayerRating
            {
                UserId = session.Player2.UserId,
                PlayFormat = session.PlayFormat,
                DisplayName = session.Player2.DisplayName,
                Rating = session.Player2.RatingBefore > 0 ? session.Player2.RatingBefore : PlayerRating.DefaultInitialRating
            };
            ratingRepo.Add(rating2);
        }

        int r1Before = rating1.Rating;
        int r2Before = rating2.Rating;
        var (delta1, delta2) = EloCalculator.CalculateDeltas(r1Before, r2Before, p1Result);

        rating1.DisplayName = session.Player1.DisplayName;
        rating1.Rating = r1Before + delta1;
        rating1.MatchesPlayed++;
        if (p1Result == MatchResult.Win) rating1.MatchesWon++;
        else if (p1Result == MatchResult.Draw) rating1.MatchesDrawn++;
        rating1.UpdatedAt = now;

        rating2.DisplayName = session.Player2.DisplayName;
        rating2.Rating = r2Before + delta2;
        rating2.MatchesPlayed++;
        if (p2Result == MatchResult.Win) rating2.MatchesWon++;
        else if (p2Result == MatchResult.Draw) rating2.MatchesDrawn++;
        rating2.UpdatedAt = now;

        // 2. Load or create Match + MatchPlayers
        var match = await matchRepo.GetByIdForUpdateAsync(session.MatchId, ct);
        if (match == null)
        {
            match = new Match
            {
                Id = session.MatchId,
                PlayFormat = session.PlayFormat,
                BoardLayout = session.BoardLayout,
                LevelId = session.LevelId,
                PuzzleId = session.PuzzleId,
                InitialBoard = session.InitialBoard,
                SolutionBoard = session.SolutionBoard,
                RegionMap = session.RegionMap,
                StartedAt = session.StartedAtUtc
            };
            match.SetRules(session.Rules);
            matchRepo.Add(match);
        }

        match.Status = (int)MatchStatus.Completed;
        match.SharedBoard = session.SharedBoard;
        match.CurrentTurnUserId = session.CurrentTurnUserId;
        match.TurnNumber = session.TurnNumber;
        match.TurnDeadline = session.TurnDeadlineUtc;
        match.WinnerUserId = winnerUserId;
        match.EndReason = endReason;
        match.DurationMs = durationMs;
        match.FinishedAt = now;

        UpsertMatchPlayer(match, session, session.Player1, session.Player2, (int)p1Result, r1Before, delta1, endReason, durationMs, now);
        UpsertMatchPlayer(match, session, session.Player2, session.Player1, (int)p2Result, r2Before, delta2, endReason, durationMs, now);

        if (session.MoveHistory.Count > 0)
        {
            matchRepo.AddMoves(session.MoveHistory);
        }

        // 3. Stage OutboxMessage for Kafka topic sudoku.events
        string effectiveWinner = winnerUserId ?? string.Empty;
        string effectiveLoser = isDraw
            ? string.Empty
            : (string.Equals(effectiveWinner, session.Player1.UserId, StringComparison.Ordinal)
                ? session.Player2.UserId
                : session.Player1.UserId);

        var completedEvt = new MatchCompleted
        {
            MatchId = session.MatchId.ToString(),
            WinnerUserId = effectiveWinner,
            LoserUserId = effectiveLoser,
            WinnerRewardCoins = 0,
            RatingDelta = Math.Abs(delta1),
            PlayFormat = session.PlayFormat,
            BoardLayout = session.BoardLayout,
            LevelId = session.LevelId,
            IsDraw = isDraw,
            DurationMs = durationMs,
            TournamentId = match.TournamentId?.ToString() ?? string.Empty
        };

        matchRepo.AddOutboxMessage(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            EventId = Guid.NewGuid().ToString(),
            Type = nameof(MatchCompleted),
            UserId = !string.IsNullOrEmpty(effectiveWinner) ? effectiveWinner : session.Player1.UserId,
            Topic = "sudoku.events",
            Payload = completedEvt.ToByteArray(),
            CreatedAt = now
        });

        // 4. Commit all changes in a single transaction!
        await uow.SaveChangesAsync(ct);

        // 5. Clean up runtime room & update Redis Elo sorted set
        await _runtimeStore.RemoveAsync(session.MatchId, session.Player1.UserId, session.Player2.UserId, ct);

        await _leaderboardCache.UpsertPlayerRatingAsync(
            session.PlayFormat,
            rating1.UserId,
            rating1.DisplayName,
            rating1.Rating,
            rating1.MatchesPlayed,
            rating1.MatchesWon,
            rating1.MatchesDrawn,
            ct);

        await _leaderboardCache.UpsertPlayerRatingAsync(
            session.PlayFormat,
            rating2.UserId,
            rating2.DisplayName,
            rating2.Rating,
            rating2.MatchesPlayed,
            rating2.MatchesWon,
            rating2.MatchesDrawn,
            ct);

        _logger.LogInformation(
            "Finalized match {MatchId} ({Format}): Winner={Winner}, Reason={Reason}, P1={P1}({D1}), P2={P2}({D2})",
            session.MatchId, (PlayFormat)session.PlayFormat, winnerUserId ?? "DRAW", endReason,
            session.Player1.UserId, delta1, session.Player2.UserId, delta2);

        return new FinalizedMatchSummary(
            MatchId: session.MatchId,
            PlayFormat: session.PlayFormat,
            BoardLayout: session.BoardLayout,
            LevelId: session.LevelId,
            IsDraw: isDraw,
            WinnerUserId: winnerUserId,
            EndReason: endReason,
            DurationMs: durationMs,
            Player1Result: (int)p1Result,
            Player2Result: (int)p2Result,
            Player1RatingBefore: r1Before,
            Player1RatingDelta: delta1,
            Player1NewRating: rating1.Rating,
            Player2RatingBefore: r2Before,
            Player2RatingDelta: delta2,
            Player2NewRating: rating2.Rating,
            Player1Score: session.Player1.Score,
            Player2Score: session.Player2.Score,
            Player1Lives: session.Player1.LivesRemaining,
            Player2Lives: session.Player2.LivesRemaining,
            Player1Mistakes: session.Player1.MistakesCount,
            Player2Mistakes: session.Player2.MistakesCount
        );
    }

    private static void UpsertMatchPlayer(
        Match match,
        ActiveMatchSession session,
        ActivePlayerRuntime player,
        ActivePlayerRuntime opponent,
        int result,
        int ratingBefore,
        int ratingDelta,
        string endReason,
        long matchDurationMs,
        DateTime finishedAt)
    {
        var entity = match.Players.FirstOrDefault(p => string.Equals(p.UserId, player.UserId, StringComparison.Ordinal));
        if (entity == null)
        {
            entity = new MatchPlayer
            {
                Id = Guid.NewGuid(),
                MatchId = match.Id,
                UserId = player.UserId,
                TurnOrder = player.TurnOrder
            };
            match.Players.Add(entity);
        }

        long completionMs = matchDurationMs + (player.PenaltySeconds * 1000L);

        entity.DisplayName = player.DisplayName;
        entity.OpponentUserId = opponent.UserId;
        entity.OpponentName = opponent.DisplayName;
        entity.OpponentScore = opponent.Score;
        entity.PlayFormat = session.PlayFormat;
        entity.BoardLayout = session.BoardLayout;
        entity.LevelId = session.LevelId;
        entity.CurrentBoard = session.PlayFormat == (int)PlayFormat.Duel ? session.SharedBoard : player.CurrentBoard;
        entity.NotesJson = JsonSerializer.Serialize(player.Notes);
        entity.LivesRemaining = player.LivesRemaining;
        entity.MistakesCount = player.MistakesCount;
        entity.CorrectCells = player.CorrectCells;
        entity.Score = player.Score;
        entity.PenaltySeconds = player.PenaltySeconds;
        entity.TimeoutCount = player.TimeoutCount;
        entity.Result = result;
        entity.EndReason = endReason;
        entity.CompletionMs = completionMs;
        entity.RatingBefore = ratingBefore;
        entity.RatingDelta = ratingDelta;
        entity.FinishedAt = finishedAt;
    }
}
