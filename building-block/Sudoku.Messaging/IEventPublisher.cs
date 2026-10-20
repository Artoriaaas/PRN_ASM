namespace Sudoku.Messaging;

using System.Threading;
using System.Threading.Tasks;

public interface IEventPublisher
{
    Task PublishAsync(string topic, EventEnvelope @event, CancellationToken cancellationToken = default);
}
