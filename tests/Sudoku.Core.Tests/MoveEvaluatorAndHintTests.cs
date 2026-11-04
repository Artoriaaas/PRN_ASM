namespace Sudoku.Core.Tests;

using Xunit;

public class MoveEvaluatorAndHintTests
{
    private const string InitialBoard =
        "530070000" +
        "600195000" +
        "098000060" +
        "800060003" +
        "400803001" +
        "700020006" +
        "060000280" +
        "000419005" +
        "000080079";

    private const string SolutionBoard =
        "534678912" +
        "672195348" +
        "198342567" +
        "859761423" +
        "426853791" +
        "713924856" +
        "961537284" +
        "287419635" +
        "345286179";

    [Fact]
    public void MoveEvaluator_GivenCellModification_IsDisallowed()
    {
        // Cell (0, 0) is '5' in InitialBoard
        var result = MoveEvaluator.Evaluate(
            InitialBoard, InitialBoard, SolutionBoard, RegionMap.Standard,
            row: 0, col: 0, value: 5
        );

        Assert.False(result.IsAllowed);
        Assert.Contains("Cannot modify", result.FailureReason);
    }

    [Fact]
    public void MoveEvaluator_CorrectMove_AwardsPointsAndCalculatesTier()
    {
        // Cell (0, 2) is '0' in InitialBoard, '4' in SolutionBoard
        var result = MoveEvaluator.Evaluate(
            InitialBoard, InitialBoard, SolutionBoard, RegionMap.Standard,
            row: 0, col: 2, value: 4
        );

        Assert.True(result.IsAllowed);
        Assert.True(result.IsCorrect);
        Assert.False(result.IsDuplicateWrong);
        Assert.True(result.PointsDelta > 0);
        Assert.NotEqual(EvaluatedDifficultyTier.Unspecified, result.Tier);
    }

    [Fact]
    public void MoveEvaluator_WrongMove_PenalizesMinus5_AndSecondAttemptIsZero()
    {
        // Cell (0, 2) solution is 4. Testing value 9 (wrong)
        var firstAttempt = MoveEvaluator.Evaluate(
            InitialBoard, InitialBoard, SolutionBoard, RegionMap.Standard,
            row: 0, col: 2, value: 9, isDuplicateWrong: false
        );

        Assert.True(firstAttempt.IsAllowed);
        Assert.False(firstAttempt.IsCorrect);
        Assert.Equal(-5, firstAttempt.PointsDelta);

        var duplicateAttempt = MoveEvaluator.Evaluate(
            InitialBoard, InitialBoard, SolutionBoard, RegionMap.Standard,
            row: 0, col: 2, value: 9, isDuplicateWrong: true
        );

        Assert.True(duplicateAttempt.IsAllowed);
        Assert.False(duplicateAttempt.IsCorrect);
        Assert.True(duplicateAttempt.IsDuplicateWrong);
        Assert.Equal(0, duplicateAttempt.PointsDelta);
    }

    [Fact]
    public void HintFinder_FindsValidHint_MatchingSolution()
    {
        var hint = HintFinder.FindHint(InitialBoard, SolutionBoard, RegionMap.Standard);

        Assert.NotNull(hint);
        int idx = CellCoord.ToIndex(hint.Row, hint.Col);
        Assert.Equal(BoardConstants.EmptyCellChar, InitialBoard[idx]);
        Assert.Equal(SolutionBoard[idx] - '0', hint.Value);
        Assert.NotEmpty(hint.HighlightCells);
    }

    [Fact]
    public void HintFinder_ReturnsNull_WhenBoardIsComplete()
    {
        var hint = HintFinder.FindHint(SolutionBoard, SolutionBoard, RegionMap.Standard);
        Assert.Null(hint);
    }
}
