namespace Game.Api.Domain.Services;

using Game.Api.Domain.Entities;
using Game.Api.Domain.Exceptions;
using Game.Api.Domain.ValueObjects;
using Sudoku.Game.V1;

public interface ISoloRulePolicy
{
    string ModeCode { get; }
    void ValidateCanStart(Level level, int layoutType);
    SessionRules CreateSessionRules(Level level);
}

public class ClassicSoloRulePolicy : ISoloRulePolicy
{
    public string ModeCode => "classic";

    public void ValidateCanStart(Level level, int layoutType)
    {
        if (!level.IsActive)
        {
            throw new ValidationException($"Level '{level.LevelId}' is currently inactive.");
        }

        // Layout standard is 1. If unspecified, caller normalizes to standard.
        // Irregular (2) is not yet enabled for generation in this phase.
        if (layoutType != (int)LayoutType.Standard)
        {
            throw new ValidationException("Only standard layout is supported in this release.");
        }
    }

    public SessionRules CreateSessionRules(Level level)
    {
        return new SessionRules
        {
            MaxMistakes = level.MaxMistakes > 0 ? level.MaxMistakes : 3,
            MaxHints = level.MaxHints >= 0 ? level.MaxHints : 3,
            TimeLimitSeconds = null
        };
    }
}
