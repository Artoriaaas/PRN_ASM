namespace Sudoku.Core.Tests;

using System;
using Xunit;

public class SudokuSolverAndGeneratorTests
{
    // A known valid classic puzzle with unique solution
    private const string KnownPuzzle =
        "530070000" +
        "600195000" +
        "098000060" +
        "800060003" +
        "400803001" +
        "700020006" +
        "060000280" +
        "000419005" +
        "000080079";

    private const string ExpectedSolution =
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
    public void SudokuSolver_SolvesKnownPuzzle_Accurately()
    {
        bool solved = SudokuSolver.Solve(KnownPuzzle, RegionMap.Standard, out string solution);

        Assert.True(solved);
        Assert.Equal(ExpectedSolution, solution);
    }

    [Fact]
    public void SudokuSolver_CountSolutions_ReturnsOneForUniquePuzzle()
    {
        int count = SudokuSolver.CountSolutions(KnownPuzzle, RegionMap.Standard, limit: 2);
        Assert.Equal(1, count);
    }

    [Fact]
    public void SudokuSolver_CountSolutions_ReturnsTwoForAmbiguousPuzzle()
    {
        // An empty board has many solutions, count should hit limit 2 immediately
        string emptyBoard = new('0', 81);
        int count = SudokuSolver.CountSolutions(emptyBoard, RegionMap.Standard, limit: 2);
        Assert.Equal(2, count);
    }

    [Fact]
    public void SudokuGenerator_GeneratesUniquePuzzle_WithRequestedClues()
    {
        var rng = new Random(42);
        var puzzle = SudokuGenerator.Generate(RegionMap.Standard, minClues: 38, maxClues: 42, rng);

        Assert.NotNull(puzzle);
        Assert.InRange(puzzle.ClueCount, 38, 42);
        Assert.Equal(BoardConstants.CellCount, puzzle.InitialBoard.Length);
        Assert.Equal(BoardConstants.CellCount, puzzle.SolutionBoard.Length);
        Assert.False(string.IsNullOrWhiteSpace(puzzle.PuzzleHash));

        // Verify solution is actually unique
        int solutionCount = SudokuSolver.CountSolutions(puzzle.InitialBoard, RegionMap.Standard, limit: 2);
        Assert.Equal(1, solutionCount);

        // Verify solver reaches exact solution board
        SudokuSolver.Solve(puzzle.InitialBoard, RegionMap.Standard, out string solved);
        Assert.Equal(puzzle.SolutionBoard, solved);
    }
}
