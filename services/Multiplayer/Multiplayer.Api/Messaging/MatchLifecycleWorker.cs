namespace Multiplayer.Api.Messaging;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Multiplayer.Api.Domain.Runtime;
using Multiplayer.Api.Domain.Services;
using Multiplayer.Api.Hubs;
using Sudoku.Multi.V1;

public sealed class MatchLifecycleWorker : BackgroundService
{
    private readonly IMatchRuntimeStore _runtimeStore;
    private readonly IMatchEngineService _matchEngine;
    private readonly IHubContext<MatchHub> _hubContext;
    private readonly ILogger<MatchLifecycleWorker> _logger;

    public MatchLifecycleWorker(
        IMatchRuntimeStore runtimeStore,
        IMatchEngineService matchEngine,
        IHubContext<MatchHub> hubContext,
        ILogger<MatchLifecycleWorker> logger)
    {
        _runtimeStore = runtimeStore;
        _matchEngine = matchEngine;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            var activeSessions = _runtimeStore.GetAllActiveInMemory();
            if (activeSessions.Count == 0)
            {
                continue;
            }

            var now = DateTime.UtcNow;
            foreach (var session in activeSessions)
            {
                if (stoppingToken.IsCancellationRequested) break;

                try
                {
                    string groupName = MatchHub.GetMatchGroupName(session.MatchId);

                    // 1. Check 15s Duel turn timeout (only after countdown has completed)
                    if (session.PlayFormat == (int)PlayFormat.Duel && now >= session.StartedAtUtc)
                    {
                        var turnTimeout = await _matchEngine.CheckAndApplyDuelTurnTimeoutAsync(session, now, stoppingToken);
                        if (turnTimeout != null)
                        {
                            if (turnTimeout.MatchEnded && turnTimeout.FinalSummary != null)
                            {
                                await _hubContext.Clients.Group(groupName).SendAsync(
                                    "MatchEnded",
                                    MatchHub.BuildMatchEndedPayload(turnTimeout.FinalSummary),
                                    stoppingToken);
                                continue;
                            }

                            await _hubContext.Clients.Group(groupName).SendAsync("TurnChanged", new
                            {
                                matchId = turnTimeout.MatchId.ToString(),
                                userId = turnTimeout.NextTurnUserId,
                                turn = turnTimeout.NextTurnNumber,
                                deadline = turnTimeout.NextTurnDeadlineUtc.ToString("O"),
                                timedOutUserId = turnTimeout.TimedOutUserId,
                                timeoutLivesRemaining = turnTimeout.LivesRemaining,
                                timeoutCount = turnTimeout.TimeoutCount
                            }, stoppingToken);
                        }
                    }

                    // 2. Check 30s disconnect expiration & overall match time limit
                    var lifecycleSummary = await _matchEngine.CheckAndApplyLifecycleExpirationsAsync(session, now, stoppingToken);
                    if (lifecycleSummary != null)
                    {
                        await _hubContext.Clients.Group(groupName).SendAsync(
                            "MatchEnded",
                            MatchHub.BuildMatchEndedPayload(lifecycleSummary),
                            stoppingToken);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Error in MatchLifecycleWorker for match {MatchId}", session.MatchId);
                }
            }
        }
    }
}
