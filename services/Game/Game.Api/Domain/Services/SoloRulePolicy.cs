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

        if (layoutType != (int)LayoutType.Standard && layoutType != (int)LayoutType.Irregular)
        {
            throw new ValidationException($"Unsupported layout type: {layoutType}.");
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
