namespace Multiplayer.Api.Domain.Entities;

using System;
using System.Collections.Generic;
using System.Text.Json;
using Multiplayer.Api.Domain.ValueObjects;

public class Match
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TournamentId { get; set; }
    public int? RoundNumber { get; set; }
    public int? BracketSlot { get; set; }
    public int PlayFormat { get; set; } = 1; // 1 = Race, 2 = Duel
    public int BoardLayout { get; set; } = 1; // 1 = Standard, 2 = Irregular
    public string LevelId { get; set; } = "easy";
    public Guid PuzzleId { get; set; }
    public string InitialBoard { get; set; } = string.Empty;
    public string SolutionBoard { get; set; } = string.Empty;
    public string RegionMap { get; set; } = string.Empty;
    public string RulesJson { get; set; } = "{}";
    public int Status { get; set; } = 1; // 1 = InProgress, 2 = Completed, 3 = Cancelled
    public string SharedBoard { get; set; } = string.Empty;
    public string? CurrentTurnUserId { get; set; }
    public int TurnNumber { get; set; } = 1;
    public DateTime? TurnDeadline { get; set; }
    public string? WinnerUserId { get; set; }
    public string EndReason { get; set; } = string.Empty;
    public long DurationMs { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public uint Version { get; set; }

    public ICollection<MatchPlayer> Players { get; set; } = new List<MatchPlayer>();
    public ICollection<MatchMove> Moves { get; set; } = new List<MatchMove>();

    public MatchRules GetRules()
    {
        if (string.IsNullOrWhiteSpace(RulesJson) || RulesJson == "{}")
        {
            return new MatchRules();
        }

        try
        {
            return JsonSerializer.Deserialize<MatchRules>(RulesJson) ?? new MatchRules();
        }
        catch
        {
            return new MatchRules();
        }
    }

    public void SetRules(MatchRules rules)
    {
        RulesJson = JsonSerializer.Serialize(rules);
    }
}
