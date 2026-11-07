namespace Multiplayer.Api.Domain.ValueObjects;

public sealed record MatchRules(
    int MaxLives = 3,
    int TurnSeconds = 15,
    int TurnGraceMs = 1000,
    int WrongTimePenaltySeconds = 10,
    int MatchTimeLimitSeconds = 900,
    int ReconnectGraceSeconds = 30,
    int CountdownSeconds = 5
);
