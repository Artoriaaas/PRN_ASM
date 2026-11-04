namespace Game.Api.Messaging;

using System;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sudoku.Game.V1;

public class PuzzleReplenishWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PuzzleReplenishWorker> _logger;

    public PuzzleReplenishWorker(IServiceProvider serviceProvider, ILogger<PuzzleReplenishWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PuzzleReplenishWorker started.");

        // Initial delay after startup
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var levelRepo = scope.ServiceProvider.GetRequiredService<ILevelRepository>();
                var puzzleBank = scope.ServiceProvider.GetRequiredService<IPuzzleBankService>();
                var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

                var activeLevels = await levelRepo.GetActiveLevelsAsync(stoppingToken);
                foreach (var lvl in activeLevels)
                {
                    if (stoppingToken.IsCancellationRequested) break;

                    // Ensure at least 15 unplayed puzzles per active level
                    int added = await puzzleBank.ReplenishBufferAsync(
                        lvl,
                        (int)LayoutType.Standard,
                        targetBuffer: 15,
                        stoppingToken
                    );

                    if (added > 0)
                    {
                        await uow.SaveChangesAsync(stoppingToken);
                        _logger.LogInformation("Replenished {Count} puzzles for level {LevelId}", added, lvl.LevelId);
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Error occurred while replenishing puzzle buffer.");
            }

            // Check every 60 seconds
            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
        }
    }
}
