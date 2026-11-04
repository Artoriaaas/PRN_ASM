namespace Sudoku.Core;

using System;
using System.Collections.Generic;
using System.Numerics;

public enum SmartHintTechnique
{
    Unspecified = 0,
    NakedSingle = 1,
    HiddenSingleRow = 2,
    HiddenSingleCol = 3,
    HiddenSingleRegion = 4,
    DirectReveal = 5
}

public sealed record SmartHintResult(
    int Row,
    int Col,
    int Value,
    SmartHintTechnique Technique,
    IReadOnlyList<int> HighlightCells
);

public static class HintFinder
{
    public static SmartHintResult? FindHint(
        string currentBoard,
        string solutionBoard,
        RegionMap regions,
        int? targetRow = null,
        int? targetCol = null)
    {
        var board = new SudokuBoard(currentBoard, regions);

        int? targetIdx = null;
        if (targetRow.HasValue && targetCol.HasValue &&
            CellCoord.IsValidCoord(targetRow.Value, targetCol.Value))
        {
            int idx = CellCoord.ToIndex(targetRow.Value, targetCol.Value);
            if (board.GetCell(idx) == BoardConstants.EmptyCellChar)
            {
                targetIdx = idx;
            }
        }

        // If a target empty cell was specified, evaluate that target cell directly
        if (targetIdx.HasValue)
        {
            var targetNaked = CheckNakedSingle(board, regions, targetIdx.Value);
            if (targetNaked != null) return targetNaked;

            var targetHidden = CheckHiddenSingleForCell(board, regions, targetIdx.Value, solutionBoard);
            if (targetHidden != null) return targetHidden;

            int targetVal = solutionBoard[targetIdx.Value] - '0';
            return new SmartHintResult(
                CellCoord.ToRow(targetIdx.Value),
                CellCoord.ToCol(targetIdx.Value),
                targetVal,
                SmartHintTechnique.DirectReveal,
                new[] { targetIdx.Value }
            );
        }

        // No target cell specified: search the entire board for the most logical next step
        // 1. Any Naked Single
        for (int idx = 0; idx < BoardConstants.CellCount; idx++)
        {
            if (board.GetCell(idx) != BoardConstants.EmptyCellChar) continue;
            var hint = CheckNakedSingle(board, regions, idx);
            if (hint != null) return hint;
        }

        // 2. Any Hidden Single
        var houseHint = FindAnyHiddenSingle(board, regions, solutionBoard);
        if (houseHint != null) return houseHint;

        // 3. Fallback: Direct Reveal on cell with least candidates
        int chosenIdx = FindMinCandidateEmptyCell(board);
        if (chosenIdx < 0 || chosenIdx >= BoardConstants.CellCount)
        {
            return null; // Board already full
        }

        int val = solutionBoard[chosenIdx] - '0';
        return new SmartHintResult(
            CellCoord.ToRow(chosenIdx),
            CellCoord.ToCol(chosenIdx),
            val,
            SmartHintTechnique.DirectReveal,
            new[] { chosenIdx }
        );
    }

    private static SmartHintResult? CheckNakedSingle(SudokuBoard board, RegionMap regions, int idx)
    {
        ushort mask = board.GetCandidatesMask(idx);
        if (BitOperations.PopCount(mask) != 1) return null;

        int value = BitOperations.TrailingZeroCount(mask) + 1;
        var highlights = new HashSet<int> { idx };

        foreach (int peer in regions.Peers[idx])
        {
            if (board.GetCell(peer) != BoardConstants.EmptyCellChar)
            {
                highlights.Add(peer);
            }
        }

        return new SmartHintResult(
            CellCoord.ToRow(idx),
            CellCoord.ToCol(idx),
            value,
            SmartHintTechnique.NakedSingle,
            new List<int>(highlights)
        );
    }

    private static SmartHintResult? CheckHiddenSingleForCell(SudokuBoard board, RegionMap regions, int idx, string solutionBoard)
    {
        int row = CellCoord.ToRow(idx);
        int col = CellCoord.ToCol(idx);
        int reg = regions.CellRegion[idx];
        ushort mask = board.GetCandidatesMask(idx);

        for (int v = 1; v <= 9; v++)
        {
            int bit = 1 << (v - 1);
            if ((mask & bit) == 0) continue;

            // Check Row
            bool uniqueInRow = true;
            foreach (int c in regions.RowCells[row])
            {
                if (c == idx || board.GetCell(c) != BoardConstants.EmptyCellChar) continue;
                if ((board.GetCandidatesMask(c) & bit) != 0) { uniqueInRow = false; break; }
            }
            if (uniqueInRow)
            {
                return new SmartHintResult(row, col, v, SmartHintTechnique.HiddenSingleRow, regions.RowCells[row]);
            }

            // Check Col
            bool uniqueInCol = true;
            foreach (int c in regions.ColCells[col])
            {
                if (c == idx || board.GetCell(c) != BoardConstants.EmptyCellChar) continue;
                if ((board.GetCandidatesMask(c) & bit) != 0) { uniqueInCol = false; break; }
            }
            if (uniqueInCol)
            {
                return new SmartHintResult(row, col, v, SmartHintTechnique.HiddenSingleCol, regions.ColCells[col]);
            }

            // Check Region
            bool uniqueInReg = true;
            foreach (int c in regions.RegionCells[reg])
            {
                if (c == idx || board.GetCell(c) != BoardConstants.EmptyCellChar) continue;
                if ((board.GetCandidatesMask(c) & bit) != 0) { uniqueInReg = false; break; }
            }
            if (uniqueInReg)
            {
                return new SmartHintResult(row, col, v, SmartHintTechnique.HiddenSingleRegion, regions.RegionCells[reg]);
            }
        }

        return null;
    }

    private static SmartHintResult? FindAnyHiddenSingle(SudokuBoard board, RegionMap regions, string solutionBoard)
    {
        for (int i = 0; i < BoardConstants.GridSize; i++)
        {
            var hint = CheckHouseHiddenSingle(board, regions.RowCells[i], SmartHintTechnique.HiddenSingleRow);
            if (hint != null) return hint;

            hint = CheckHouseHiddenSingle(board, regions.ColCells[i], SmartHintTechnique.HiddenSingleCol);
            if (hint != null) return hint;

            hint = CheckHouseHiddenSingle(board, regions.RegionCells[i], SmartHintTechnique.HiddenSingleRegion);
            if (hint != null) return hint;
        }

        return null;
    }

    private static SmartHintResult? CheckHouseHiddenSingle(SudokuBoard board, int[] house, SmartHintTechnique technique)
    {
        Span<int> count = stackalloc int[10];
        Span<int> lastIndex = stackalloc int[10];

        foreach (int idx in house)
        {
            if (board.GetCell(idx) != BoardConstants.EmptyCellChar) continue;
            ushort mask = board.GetCandidatesMask(idx);
            for (int v = 1; v <= 9; v++)
            {
                if ((mask & (1 << (v - 1))) != 0)
                {
                    count[v]++;
                    lastIndex[v] = idx;
                }
            }
        }

        for (int v = 1; v <= 9; v++)
        {
            if (count[v] == 1)
            {
                int target = lastIndex[v];
                return new SmartHintResult(
                    CellCoord.ToRow(target),
                    CellCoord.ToCol(target),
                    v,
                    technique,
                    house
                );
            }
        }

        return null;
    }

    private static int FindMinCandidateEmptyCell(SudokuBoard board)
    {
        int bestIdx = -1;
        int minCandidates = 10;

        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            if (board.GetCell(i) != BoardConstants.EmptyCellChar) continue;
            int count = board.CountCandidates(i);
            if (count < minCandidates)
            {
                minCandidates = count;
                bestIdx = i;
                if (minCandidates == 1) break;
            }
        }

        return bestIdx;
    }
}
