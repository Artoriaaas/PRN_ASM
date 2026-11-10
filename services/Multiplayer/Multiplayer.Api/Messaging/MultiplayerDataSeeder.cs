namespace Multiplayer.Api.Messaging;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Multiplayer.Api.Data;

public sealed class MultiplayerDataSeeder : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MultiplayerDataSeeder> _logger;

    public MultiplayerDataSeeder(IServiceProvider serviceProvider, ILogger<MultiplayerDataSeeder> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MultiplayerDbContext>();
            await db.Database.MigrateAsync(cancellationToken);
            _logger.LogInformation("Multiplayer database migrations applied successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not apply Multiplayer database migrations on startup.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
