namespace Sudoku.Core;

using System;
using System.Security.Cryptography;
using System.Text;

public sealed record GeneratedPuzzle(
    string InitialBoard,
    string SolutionBoard,
    string RegionMap,
    int ClueCount,
    string PuzzleHash
);

public static class SudokuGenerator
{
    public static GeneratedPuzzle Generate(
        RegionMap regions,
        int minClues,
        int maxClues,
        Random? rng = null,
        bool requireEvenEmptyCells = false)
    {
        rng ??= Random.Shared;

        int targetClues = rng.Next(minClues, maxClues + 1);
        if (requireEvenEmptyCells && (BoardConstants.CellCount - targetClues) % 2 != 0)
        {
            targetClues = targetClues + 1 <= maxClues ? targetClues + 1 : Math.Max(17, targetClues - 1);
        }
        // 1. Generate a completely filled valid solution board
        char[] solution = GenerateFullBoard(regions, rng);
        char[] puzzle = (char[])solution.Clone();

        // 2. Shuffle indices 0..80 to dig holes randomly
        int[] cellOrder = new int[BoardConstants.CellCount];
        for (int i = 0; i < BoardConstants.CellCount; i++) cellOrder[i] = i;
        rng.Shuffle(cellOrder);

        int currentClues = BoardConstants.CellCount;
        int lastRemovedIndex = -1;
        char lastRemovedChar = BoardConstants.EmptyCellChar;

        foreach (int idx in cellOrder)
        {
            if (currentClues <= targetClues)
            {
                break;
            }

            char original = puzzle[idx];
            puzzle[idx] = BoardConstants.EmptyCellChar;

            // Check if still uniquely solvable
            int solutions = SudokuSolver.CountSolutions(puzzle, regions, limit: 2);
            if (solutions == 1)
            {
                currentClues--;
                lastRemovedIndex = idx;
                lastRemovedChar = original;
            }
            else
            {
                // Restore cell
                puzzle[idx] = original;
            }
        }

        if (requireEvenEmptyCells && (BoardConstants.CellCount - currentClues) % 2 != 0 && lastRemovedIndex >= 0)
        {
            puzzle[lastRemovedIndex] = lastRemovedChar;
            currentClues++;
        }
        string initialBoardStr = new(puzzle);
        string solutionBoardStr = new(solution);
        string regionMapStr = regions.MapString;
        string hash = ComputePuzzleHash(initialBoardStr, regionMapStr);

        return new GeneratedPuzzle(
            InitialBoard: initialBoardStr,
            SolutionBoard: solutionBoardStr,
            RegionMap: regionMapStr,
            ClueCount: currentClues,
            PuzzleHash: hash
        );
    }

    public static string ComputePuzzleHash(string initialBoard, string regionMap)
    {
        string raw = $"{initialBoard}|{regionMap}";
        byte[] bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static char[] GenerateFullBoard(RegionMap regions, Random rng)
    {
        char[] board = new string(BoardConstants.EmptyCellChar, BoardConstants.CellCount).ToCharArray();
        FillRandom(board, regions, 0, rng);
        return board;
    }

    private static bool FillRandom(char[] board, RegionMap regions, int index, Random rng)
    {
        if (index >= BoardConstants.CellCount)
        {
            return true;
        }

        int r = CellCoord.ToRow(index);
        int c = CellCoord.ToCol(index);
        int reg = regions.CellRegion[index];

        Span<int> digits = stackalloc int[] { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
        rng.Shuffle(digits);

        foreach (int val in digits)
        {
            char valChar = (char)('0' + val);
            if (IsValidPlacement(board, regions, r, c, reg, valChar))
            {
                board[index] = valChar;
                if (FillRandom(board, regions, index + 1, rng))
                {
                    return true;
                }
                board[index] = BoardConstants.EmptyCellChar;
            }
        }

        return false;
    }

    private static bool IsValidPlacement(char[] board, RegionMap regions, int row, int col, int reg, char valChar)
    {
        foreach (int c in regions.RowCells[row])
        {
            if (board[c] == valChar) return false;
        }

        foreach (int c in regions.ColCells[col])
        {
            if (board[c] == valChar) return false;
        }

        foreach (int c in regions.RegionCells[reg])
        {
            if (board[c] == valChar) return false;
        }

        return true;
    }
}
