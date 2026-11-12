namespace User.Api.Messaging;

using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Confluent.Kafka;
using Google.Protobuf;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sudoku.Events.V1;
using User.Api.Domain.Services;

public sealed class GameEventsConsumerWorker : BackgroundService
{
    private const string HandlerName = nameof(GameEventsConsumerWorker);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<GameEventsConsumerWorker> _logger;

    public GameEventsConsumerWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        ILogger<GameEventsConsumerWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        var bootstrapServers = _config["Kafka:BootstrapServers"] ?? "localhost:9092";
        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = "user-service-events-consumer",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false,
            EnableAutoOffsetStore = false
        };

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<string, byte[]>(consumerConfig).Build();
                consumer.Subscribe("sudoku.events");
                _logger.LogInformation("GameEventsConsumerWorker subscribed to topic sudoku.events at {BootstrapServers}", bootstrapServers);

                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {
                        var consumeResult = consumer.Consume(TimeSpan.FromMilliseconds(500));
                        if (consumeResult == null || consumeResult.IsPartitionEOF)
                        {
                            await Task.Delay(200, stoppingToken);
                            continue;
                        }

                        string eventId = Guid.NewGuid().ToString();
                        string eventType = string.Empty;

                        if (consumeResult.Message.Headers != null)
                        {
                            if (consumeResult.Message.Headers.TryGetLastBytes("eventId", out var idBytes))
                            {
                                eventId = Encoding.UTF8.GetString(idBytes);
                            }

                            if (consumeResult.Message.Headers.TryGetLastBytes("type", out var typeBytes))
                            {
                                eventType = Encoding.UTF8.GetString(typeBytes);
                            }
                        }

                        using var scope = _scopeFactory.CreateScope();
                        var profileService = scope.ServiceProvider.GetRequiredService<IUserProfileService>();

                        if (string.Equals(eventType, nameof(GameFinished), StringComparison.OrdinalIgnoreCase))
                        {
                            var gameFinished = GameFinished.Parser.ParseFrom(consumeResult.Message.Value);
                            await profileService.HandleGameFinishedEventAsync(eventId, HandlerName, gameFinished, stoppingToken);
                        }
                        else if (string.Equals(eventType, nameof(MatchCompleted), StringComparison.OrdinalIgnoreCase))
                        {
                            var matchCompleted = MatchCompleted.Parser.ParseFrom(consumeResult.Message.Value);
                            await profileService.HandleMatchCompletedEventAsync(eventId, HandlerName, matchCompleted, stoppingToken);
                        }

                        consumer.StoreOffset(consumeResult);
                        consumer.Commit(consumeResult);
                    }
                    catch (ConsumeException ex)
                    {
                        _logger.LogWarning(ex, "ConsumeException in GameEventsConsumerWorker: {Reason}", ex.Error.Reason);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        _logger.LogError(ex, "Error processing event from Kafka topic sudoku.events");
                        await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Connection error in GameEventsConsumerWorker. Will retry in 5s.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }
}
