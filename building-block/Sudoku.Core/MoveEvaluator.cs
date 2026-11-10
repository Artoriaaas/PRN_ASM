namespace Sudoku.Core;

using System;
using System.Numerics;

public enum EvaluatedDifficultyTier
{
    Unspecified = 0,
    NakedSingle = 1,
    HiddenSingle = 2,
    Advanced = 3
}

public sealed record MoveEvaluationResult(
    bool IsAllowed,
    bool IsCorrect,
    bool IsDuplicateWrong,
    EvaluatedDifficultyTier Tier,
    int PointsDelta,
    string? FailureReason = null
);

public static class MoveEvaluator
{
    public const int NakedSinglePoints = 5;
    public const int HiddenSinglePoints = 10;
    public const int AdvancedPointsPerCandidate = 8;
    public const int WrongMovePenalty = -5;

    public static MoveEvaluationResult Evaluate(
        string initialBoard,
        string currentBoard,
        string solutionBoard,
        RegionMap regions,
        int row,
        int col,
        int value,
        bool isDuplicateWrong = false)
    {
        if (!CellCoord.IsValidCoord(row, col))
        {
            return new MoveEvaluationResult(false, false, false, EvaluatedDifficultyTier.Unspecified, 0, "Coordinates out of bounds.");
        }

        if (!CellCoord.IsValidDigit(value))
        {
            return new MoveEvaluationResult(false, false, false, EvaluatedDifficultyTier.Unspecified, 0, "Value must be between 1 and 9.");
        }

        int idx = CellCoord.ToIndex(row, col);

        if (initialBoard[idx] != BoardConstants.EmptyCellChar)
        {
            return new MoveEvaluationResult(false, false, false, EvaluatedDifficultyTier.Unspecified, 0, "Cannot modify a puzzle given cell.");
        }

        if (currentBoard[idx] != BoardConstants.EmptyCellChar)
        {
            return new MoveEvaluationResult(false, false, false, EvaluatedDifficultyTier.Unspecified, 0, "Cell has already been correctly filled.");
        }

        char expectedChar = solutionBoard[idx];
        char valueChar = (char)('0' + value);
        bool isCorrect = (expectedChar == valueChar);

        if (!isCorrect)
        {
            int penalty = isDuplicateWrong ? 0 : WrongMovePenalty;
            return new MoveEvaluationResult(
                IsAllowed: true,
                IsCorrect: false,
                IsDuplicateWrong: isDuplicateWrong,
                Tier: EvaluatedDifficultyTier.Unspecified,
                PointsDelta: penalty
            );
        }

        // Correct move: evaluate dynamic difficulty tier on currentBoard *before* placing the digit
        var board = new SudokuBoard(currentBoard, regions);
        ushort cellMask = board.GetCandidatesMask(idx);
        int candidateCount = BitOperations.PopCount(cellMask);

        EvaluatedDifficultyTier tier;
        int points;

        if (candidateCount == 1)
        {
            tier = EvaluatedDifficultyTier.NakedSingle;
            points = NakedSinglePoints;
        }
        else if (IsHiddenSingle(board, regions, idx, value))
        {
            tier = EvaluatedDifficultyTier.HiddenSingle;
            points = HiddenSinglePoints;
        }
        else
        {
            tier = EvaluatedDifficultyTier.Advanced;
            points = AdvancedPointsPerCandidate * Math.Max(1, candidateCount);
        }

        return new MoveEvaluationResult(
            IsAllowed: true,
            IsCorrect: true,
            IsDuplicateWrong: false,
            Tier: tier,
            PointsDelta: points
        );
    }

    private static bool IsHiddenSingle(SudokuBoard board, RegionMap regions, int idx, int value)
    {
        int targetBit = 1 << (value - 1);
        int row = CellCoord.ToRow(idx);
        int col = CellCoord.ToCol(idx);
        int reg = regions.CellRegion[idx];

        // Check if value is unique in row
        bool uniqueInRow = true;
        foreach (int c in regions.RowCells[row])
        {
            if (c == idx || board.GetCell(c) != BoardConstants.EmptyCellChar) continue;
            if ((board.GetCandidatesMask(c) & targetBit) != 0)
            {
                uniqueInRow = false;
                break;
            }
        }
        if (uniqueInRow) return true;

        // Check if value is unique in col
        bool uniqueInCol = true;
        foreach (int c in regions.ColCells[col])
        {
            if (c == idx || board.GetCell(c) != BoardConstants.EmptyCellChar) continue;
            if ((board.GetCandidatesMask(c) & targetBit) != 0)
            {
                uniqueInCol = false;
                break;
            }
        }
        if (uniqueInCol) return true;

        // Check if value is unique in region
        bool uniqueInReg = true;
        foreach (int c in regions.RegionCells[reg])
        {
            if (c == idx || board.GetCell(c) != BoardConstants.EmptyCellChar) continue;
            if ((board.GetCandidatesMask(c) & targetBit) != 0)
            {
                uniqueInReg = false;
                break;
            }
        }
        return uniqueInReg;
    }
}
