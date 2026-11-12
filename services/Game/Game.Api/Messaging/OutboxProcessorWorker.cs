namespace Game.Api.Messaging;

using System;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sudoku.Messaging;

public sealed class OutboxProcessorWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEventPublisher _eventPublisher;
    private readonly ILogger<OutboxProcessorWorker> _logger;

    public OutboxProcessorWorker(
        IServiceScopeFactory scopeFactory,
        IEventPublisher eventPublisher,
        ILogger<OutboxProcessorWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _eventPublisher = eventPublisher;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var sessionRepo = scope.ServiceProvider.GetRequiredService<IGameSessionRepository>();
                var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

                var pending = await sessionRepo.GetUnprocessedOutboxMessagesAsync(limit: 50, stoppingToken);
                if (pending.Count == 0)
                {
                    continue;
                }

                foreach (var msg in pending)
                {
                    try
                    {
                        var envelope = new EventEnvelope
                        {
                            EventId = msg.EventId,
                            Type = msg.Type,
                            OccurredAt = msg.CreatedAt,
                            UserId = msg.UserId,
                            Payload = msg.Payload
                        };

                        await _eventPublisher.PublishAsync(msg.Topic, envelope, stoppingToken);
                        msg.ProcessedAt = DateTime.UtcNow;
                        msg.Error = null;
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        msg.Error = ex.Message;
                        _logger.LogWarning(ex, "Failed to publish Game outbox message {OutboxId} ({Type}); will retry", msg.Id, msg.Type);
                    }
                }

                await uow.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Error in Game OutboxProcessorWorker cycle");
            }
        }
    }
}
