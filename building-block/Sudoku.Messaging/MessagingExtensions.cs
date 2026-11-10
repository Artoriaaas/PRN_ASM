namespace Sudoku.Messaging;

using Microsoft.Extensions.DependencyInjection;

public static class MessagingExtensions
{
    public static IServiceCollection AddSudokuKafkaPublisher(this IServiceCollection services)
    {
        services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
        return services;
    }
}
