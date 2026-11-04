namespace Sudoku.Core;

using System;
using System.Numerics;

public sealed class SudokuSolver
{
    public static bool Solve(ReadOnlySpan<char> initialBoard, RegionMap regions, out string solution)
    {
        Span<char> board = stackalloc char[BoardConstants.CellCount];
        initialBoard.CopyTo(board);

        Span<int> rowMask = stackalloc int[BoardConstants.GridSize];
        Span<int> colMask = stackalloc int[BoardConstants.GridSize];
        Span<int> regMask = stackalloc int[BoardConstants.RegionCount];

        InitMasks(board, regions, rowMask, colMask, regMask);

        if (SolveInternal(board, regions, rowMask, colMask, regMask))
        {
            solution = new string(board);
            return true;
        }

        solution = string.Empty;
        return false;
    }

    public static int CountSolutions(ReadOnlySpan<char> initialBoard, RegionMap regions, int limit = 2)
    {
        Span<char> board = stackalloc char[BoardConstants.CellCount];
        initialBoard.CopyTo(board);

        Span<int> rowMask = stackalloc int[BoardConstants.GridSize];
        Span<int> colMask = stackalloc int[BoardConstants.GridSize];
        Span<int> regMask = stackalloc int[BoardConstants.RegionCount];

        if (!InitMasks(board, regions, rowMask, colMask, regMask))
        {
            return 0;
        }

        int count = 0;
        CountInternal(board, regions, rowMask, colMask, regMask, ref count, limit);
        return count;
    }

    private static bool InitMasks(
        ReadOnlySpan<char> board,
        RegionMap regions,
        Span<int> rowMask,
        Span<int> colMask,
        Span<int> regMask)
    {
        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            char c = board[i];
            if (c == BoardConstants.EmptyCellChar) continue;

            int bit = 1 << (c - '1');
            int r = CellCoord.ToRow(i);
            int col = CellCoord.ToCol(i);
            int reg = regions.CellRegion[i];

            if ((rowMask[r] & bit) != 0 || (colMask[col] & bit) != 0 || (regMask[reg] & bit) != 0)
            {
                return false; // Conflicting initial board
            }

            rowMask[r] |= bit;
            colMask[col] |= bit;
            regMask[reg] |= bit;
        }
        return true;
    }

    private static bool SolveInternal(
        Span<char> board,
        RegionMap regions,
        Span<int> rowMask,
        Span<int> colMask,
        Span<int> regMask)
    {
        int bestIdx = -1;
        int minCandidates = 10;
        int bestMask = 0;

        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            if (board[i] != BoardConstants.EmptyCellChar) continue;

            int r = CellCoord.ToRow(i);
            int c = CellCoord.ToCol(i);
            int reg = regions.CellRegion[i];

            int used = rowMask[r] | colMask[c] | regMask[reg];
            int available = 0x1FF & ~used;
            int count = BitOperations.PopCount((uint)available);

            if (count == 0) return false;

            if (count < minCandidates)
            {
                minCandidates = count;
                bestIdx = i;
                bestMask = available;
                if (count == 1) break;
            }
        }

        if (bestIdx == -1) return true; // All filled

        int rBest = CellCoord.ToRow(bestIdx);
        int cBest = CellCoord.ToCol(bestIdx);
        int regBest = regions.CellRegion[bestIdx];

        while (bestMask != 0)
        {
            int bit = bestMask & -bestMask;
            bestMask &= ~bit;

            int val = BitOperations.TrailingZeroCount(bit) + 1;
            char valChar = (char)('0' + val);

            board[bestIdx] = valChar;
            rowMask[rBest] |= bit;
            colMask[cBest] |= bit;
            regMask[regBest] |= bit;

            if (SolveInternal(board, regions, rowMask, colMask, regMask))
            {
                return true;
            }

            board[bestIdx] = BoardConstants.EmptyCellChar;
            rowMask[rBest] &= ~bit;
            colMask[cBest] &= ~bit;
            regMask[regBest] &= ~bit;
        }

        return false;
    }

    private static void CountInternal(
        Span<char> board,
        RegionMap regions,
        Span<int> rowMask,
        Span<int> colMask,
        Span<int> regMask,
        ref int count,
        int limit)
    {
        if (count >= limit) return;

        int bestIdx = -1;
        int minCandidates = 10;
        int bestMask = 0;

        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            if (board[i] != BoardConstants.EmptyCellChar) continue;

            int r = CellCoord.ToRow(i);
            int c = CellCoord.ToCol(i);
            int reg = regions.CellRegion[i];

            int used = rowMask[r] | colMask[c] | regMask[reg];
            int available = 0x1FF & ~used;
            int cnt = BitOperations.PopCount((uint)available);

            if (cnt == 0) return;

            if (cnt < minCandidates)
            {
                minCandidates = cnt;
                bestIdx = i;
                bestMask = available;
                if (cnt == 1) break;
            }
        }

        if (bestIdx == -1)
        {
            count++;
            return;
        }

        int rBest = CellCoord.ToRow(bestIdx);
        int cBest = CellCoord.ToCol(bestIdx);
        int regBest = regions.CellRegion[bestIdx];

        while (bestMask != 0)
        {
            int bit = bestMask & -bestMask;
            bestMask &= ~bit;

            board[bestIdx] = (char)('1' + BitOperations.TrailingZeroCount(bit));
            rowMask[rBest] |= bit;
            colMask[cBest] |= bit;
            regMask[regBest] |= bit;

            CountInternal(board, regions, rowMask, colMask, regMask, ref count, limit);
            if (count >= limit) return;

            board[bestIdx] = BoardConstants.EmptyCellChar;
            rowMask[rBest] &= ~bit;
            colMask[cBest] &= ~bit;
            regMask[regBest] &= ~bit;
        }
    }
}
