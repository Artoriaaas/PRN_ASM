namespace Sudoku.Messaging;

using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

public sealed class KafkaEventPublisher : IEventPublisher, IDisposable
{
    private readonly IProducer<string, byte[]> _producer;
    private readonly ILogger<KafkaEventPublisher> _logger;

    public KafkaEventPublisher(IConfiguration config, ILogger<KafkaEventPublisher> logger)
    {
        _logger = logger;
        var bootstrapServers = config["Kafka:BootstrapServers"] ?? "localhost:9092";

        var producerConfig = new ProducerConfig
        {
            BootstrapServers = bootstrapServers,
            Acks = Acks.All,
            EnableIdempotence = true,
            MessageSendMaxRetries = 3,
            MessageTimeoutMs = 5000
        };

        _producer = new ProducerBuilder<string, byte[]>(producerConfig).Build();
    }

    public async Task PublishAsync(string topic, EventEnvelope @event, CancellationToken cancellationToken = default)
    {
        var message = new Message<string, byte[]>
        {
            Key = @event.UserId,
            Value = @event.Payload,
            Headers = new Headers
            {
                { "eventId", Encoding.UTF8.GetBytes(@event.EventId) },
                { "type", Encoding.UTF8.GetBytes(@event.Type) }
            }
        };

        await _producer.ProduceAsync(topic, message, cancellationToken);
        _logger.LogInformation("Published Kafka event {Type} (Id: {EventId}) to topic {Topic}",
            @event.Type, @event.EventId, topic);
    }

    public void Dispose()
    {
        try
        {
            _producer.Flush(TimeSpan.FromSeconds(2));
            _producer.Dispose();
        }
        catch
        {
            // Ignore disposal errors when broker is unreachable
        }
    }
}
