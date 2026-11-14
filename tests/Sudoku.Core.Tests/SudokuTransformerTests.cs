namespace Sudoku.Core.Tests;

using System;
using Xunit;

public class SudokuTransformerTests
{
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
    public void ApplyDigitPermutation_PreservesEmptyCells_AndMaintainsValidity()
    {
        var (newInit, newSol) = SudokuTransformer.ApplyDigitPermutation(KnownPuzzle, ExpectedSolution);

        Assert.Equal(BoardConstants.CellCount, newInit.Length);
        Assert.Equal(BoardConstants.CellCount, newSol.Length);

        // Vị trí các ô trống ('0') phải được bảo toàn nguyên vẹn
        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            if (KnownPuzzle[i] == '0')
            {
                Assert.Equal('0', newInit[i]);
            }
            else
            {
                Assert.NotEqual('0', newInit[i]);
            }
        }

        // Bàn cờ mới vẫn phải giải được và cho ra nghiệm đúng bằng newSol
        bool solved = SudokuSolver.Solve(newInit, RegionMap.Standard, out string solution);
        Assert.True(solved);
        Assert.Equal(newSol, solution);

        // Vẫn phải có nghiệm duy nhất
        int solutionsCount = SudokuSolver.CountSolutions(newInit, RegionMap.Standard, limit: 2);
        Assert.Equal(1, solutionsCount);
    }

    [Fact]
    public void TransformStandard_ProducesValidUniquePuzzle()
    {
        var (transformedInit, transformedSol) = SudokuTransformer.TransformStandard(KnownPuzzle, ExpectedSolution);

        Assert.Equal(BoardConstants.CellCount, transformedInit.Length);
        Assert.Equal(BoardConstants.CellCount, transformedSol.Length);

        // Giải thử bàn cờ đã qua xoay, lật và hoán vị số
        bool solved = SudokuSolver.Solve(transformedInit, RegionMap.Standard, out string actualSolution);
        Assert.True(solved);
        Assert.Equal(transformedSol, actualSolution);

        int count = SudokuSolver.CountSolutions(transformedInit, RegionMap.Standard, limit: 2);
        Assert.Equal(1, count);
    }

    [Fact]
    public void Rotate_FourTimes_ReturnsOriginalBoard()
    {
        string rotated = SudokuTransformer.Rotate(KnownPuzzle, 4);
        Assert.Equal(KnownPuzzle, rotated);
    }

    [Fact]
    public void Reflect_Twice_ReturnsOriginalBoard()
    {
        string reflected = SudokuTransformer.Reflect(KnownPuzzle, horizontal: true);
        string twice = SudokuTransformer.Reflect(reflected, horizontal: true);
        Assert.Equal(KnownPuzzle, twice);
    }
}
