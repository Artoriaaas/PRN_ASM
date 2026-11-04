namespace Game.Api.Domain.ValueObjects;

public sealed record SessionRules
{
    public int MaxMistakes { get; init; } = 3;
    public int MaxHints { get; init; } = 3;
    public int? TimeLimitSeconds { get; init; }
}
