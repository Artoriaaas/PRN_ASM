namespace Support.Api.Messaging;

using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Confluent.Kafka;
using Google.Protobuf;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sudoku.Events.V1;
using Sudoku.Messaging;
using Support.Api.Data;
using Support.Api.Domain.Entities;
using Support.Api.Domain.Services;

public sealed class SupportEventsConsumerWorker : BackgroundService
{
    private const string HandlerName = nameof(SupportEventsConsumerWorker);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<SupportEventsConsumerWorker> _logger;

    public SupportEventsConsumerWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        ILogger<SupportEventsConsumerWorker> logger)
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
            GroupId = "support-service-events-consumer",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false,
            EnableAutoOffsetStore = false
        };

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<string, byte[]>(consumerConfig).Build();
                consumer.Subscribe(new[] { "user.admin-action.v1", "game.rules-changed.v1", "sudoku.events" });
                _logger.LogInformation("SupportEventsConsumerWorker subscribed to topics at {BootstrapServers}", bootstrapServers);

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
                        var db = scope.ServiceProvider.GetRequiredService<SupportDbContext>();
                        var uow = scope.ServiceProvider.GetRequiredService<ISupportUnitOfWork>();

                        bool alreadyProcessed = await db.InboxMessages
                            .AsNoTracking()
                            .AnyAsync(x => x.EventId == eventId && x.HandlerName == HandlerName, stoppingToken);

                        if (!alreadyProcessed)
                        {
                            if (consumeResult.Topic == "user.admin-action.v1" || string.Equals(eventType, nameof(UserAdminAction), StringComparison.OrdinalIgnoreCase))
                            {
                                var action = UserAdminAction.Parser.ParseFrom(consumeResult.Message.Value);
                                await HandleUserAdminActionAsync(db, eventId, action, stoppingToken);
                            }
                            else if (consumeResult.Topic == "game.rules-changed.v1" || string.Equals(eventType, nameof(GameRulesChanged), StringComparison.OrdinalIgnoreCase))
                            {
                                var rules = GameRulesChanged.Parser.ParseFrom(consumeResult.Message.Value);
                                await HandleGameRulesChangedAsync(db, eventId, rules, stoppingToken);
                            }

                            await db.InboxMessages.AddAsync(new InboxMessage
                            {
                                EventId = eventId,
                                HandlerName = HandlerName,
                                ReceivedAt = DateTime.UtcNow,
                                ProcessedAt = DateTime.UtcNow
                            }, stoppingToken);

                            await uow.SaveChangesAsync(stoppingToken);
                        }

                        consumer.StoreOffset(consumeResult);
                        consumer.Commit(consumeResult);
                    }
                    catch (ConsumeException ex)
                    {
                        _logger.LogWarning(ex, "ConsumeException in SupportEventsConsumerWorker: {Reason}", ex.Error.Reason);
                        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        _logger.LogError(ex, "Error processing event in SupportEventsConsumerWorker");
                        await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Connection error in SupportEventsConsumerWorker. Will retry in 5s.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private static async Task HandleUserAdminActionAsync(
        SupportDbContext db,
        string eventId,
        UserAdminAction action,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(action.UserId)) return;

        string title;
        string body;

        switch (action.Action?.ToUpperInvariant())
        {
            case "BANNED":
                title = "Tài khoản của bạn đã bị khóa";
                body = string.IsNullOrWhiteSpace(action.BannedUntil)
                    ? $"Tài khoản của bạn đã bị khóa vĩnh viễn. Lý do: {action.Reason}"
                    : $"Tài khoản của bạn đã bị khóa đến {action.BannedUntil}. Lý do: {action.Reason}";
                break;

            case "UNBANNED":
                title = "Tài khoản của bạn đã được mở khóa";
                body = $"Tài khoản của bạn đã được khôi phục quyền truy cập. Lý do: {action.Reason}";
                break;

            case "ELO_ADJUSTED":
                title = "Điểm Elo đã được điều chỉnh";
                string deltaStr = action.EloDelta >= 0 ? $"+{action.EloDelta}" : action.EloDelta.ToString();
                body = $"Điểm Elo của bạn đã được quản trị viên điều chỉnh ({deltaStr}). Lý do: {action.Reason}";
                break;

            case "ROLE_CHANGED":
                title = "Vai trò tài khoản đã thay đổi";
                body = $"Vai trò tài khoản của bạn đã được cập nhật bởi quản trị viên. Lý do: {action.Reason}";
                break;

            default:
                title = "Thông báo từ Quản trị viên";
                body = $"Thao tác quản trị: {action.Action}. Lý do: {action.Reason}";
                break;
        }

        await db.Notifications.AddAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = action.UserId,
            Type = "ADMIN_ACTION",
            Title = title,
            Body = body,
            SourceEventId = eventId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }, ct);
    }

    private static async Task HandleGameRulesChangedAsync(
        SupportDbContext db,
        string eventId,
        GameRulesChanged rules,
        CancellationToken ct)
    {
        DateTime publishedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(rules.EffectiveAt) && DateTime.TryParse(rules.EffectiveAt, out var parsed))
        {
            publishedAt = parsed;
        }

        await db.SystemNotices.AddAsync(new SystemNotice
        {
            Id = Guid.NewGuid(),
            Title = string.IsNullOrWhiteSpace(rules.Title) ? "Cập nhật luật chơi mới" : rules.Title,
            Content = rules.Content,
            Category = "Update",
            IsPinned = true,
            PublishedAt = publishedAt,
            CreatedAt = DateTime.UtcNow
        }, ct);
    }
}
