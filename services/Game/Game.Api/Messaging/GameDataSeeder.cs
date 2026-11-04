namespace Game.Api.Messaging;

using System;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Data;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sudoku.Game.V1;

public class GameDataSeeder : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<GameDataSeeder> _logger;

    public GameDataSeeder(IServiceProvider serviceProvider, ILogger<GameDataSeeder> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GameDbContext>();
        var levelRepo = scope.ServiceProvider.GetRequiredService<ILevelRepository>();
        var puzzleBank = scope.ServiceProvider.GetRequiredService<IPuzzleBankService>();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        try
        {
            _logger.LogInformation("Applying EF Core migrations for GameDbContext...");
            await db.Database.MigrateAsync(cancellationToken);

            bool hasLevels = await levelRepo.HasAnyAsync(cancellationToken);
            if (!hasLevels)
            {
                _logger.LogInformation("Seeding initial Sudoku difficulty levels...");
                var levels = new[]
                {
                    new Level { LevelId = "easy", Name = "Easy", SortOrder = 1, MinClues = 38, MaxClues = 42, MaxMistakes = 3, MaxHints = 3, IsActive = true },
                    new Level { LevelId = "medium", Name = "Medium", SortOrder = 2, MinClues = 32, MaxClues = 36, MaxMistakes = 3, MaxHints = 3, IsActive = true },
                    new Level { LevelId = "hard", Name = "Hard", SortOrder = 3, MinClues = 28, MaxClues = 31, MaxMistakes = 3, MaxHints = 3, IsActive = true },
                    new Level { LevelId = "expert", Name = "Expert", SortOrder = 4, MinClues = 24, MaxClues = 27, MaxMistakes = 3, MaxHints = 3, IsActive = true }
                };

                foreach (var lvl in levels)
                {
                    levelRepo.Add(lvl);
                }

                await uow.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Levels seeded successfully.");

                // Seed initial small buffer of 5 puzzles per level so startup games are instantaneous
                foreach (var lvl in levels)
                {
                    await puzzleBank.ReplenishBufferAsync(lvl, (int)LayoutType.Standard, targetBuffer: 5, cancellationToken);
                }
                await uow.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to apply migrations or seed initial game data.");
            // Do not crash startup in development if DB is temporarily unreachable
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
