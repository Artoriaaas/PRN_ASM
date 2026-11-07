namespace Multiplayer.Api.Domain.Services;

using System;
using Sudoku.Multi.V1;

public static class EloCalculator
{
    public const int KFactor = 32;
    public const int MinRating = 100;

    public static (int Player1Delta, int Player2Delta) CalculateDeltas(
        int player1Rating,
        int player2Rating,
        MatchResult player1Result)
    {
        double expected1 = 1.0 / (1.0 + Math.Pow(10.0, (player2Rating - player1Rating) / 400.0));
        double actual1 = player1Result switch
        {
            MatchResult.Win => 1.0,
            MatchResult.Draw => 0.5,
            _ => 0.0
        };

        int delta1 = (int)Math.Round(KFactor * (actual1 - expected1), MidpointRounding.AwayFromZero);
        int delta2 = -delta1;

        if (player1Rating + delta1 < MinRating)
        {
            delta1 = MinRating - player1Rating;
        }

        if (player2Rating + delta2 < MinRating)
        {
            delta2 = MinRating - player2Rating;
        }

        return (delta1, delta2);
    }
}
