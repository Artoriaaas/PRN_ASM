namespace Sudoku.Core;

using System;
using System.Numerics;

public sealed class SudokuBoard
{
    private readonly char[] _grid;
    public RegionMap Regions { get; }

    public ReadOnlySpan<char> Cells => _grid;

    public SudokuBoard(string initialBoard, RegionMap? regions = null)
    {
        if (string.IsNullOrWhiteSpace(initialBoard) || initialBoard.Length != BoardConstants.CellCount)
        {
            throw new ArgumentException($"Board must be exactly {BoardConstants.CellCount} characters.", nameof(initialBoard));
        }

        _grid = initialBoard.ToCharArray();
        Regions = regions ?? RegionMap.Standard;
    }

    public SudokuBoard(RegionMap? regions = null)
    {
        _grid = new string(BoardConstants.EmptyCellChar, BoardConstants.CellCount).ToCharArray();
        Regions = regions ?? RegionMap.Standard;
    }

    public char GetCell(int index) => _grid[index];

    public char GetCell(int row, int col) => _grid[CellCoord.ToIndex(row, col)];

    public void SetCell(int index, char value) => _grid[index] = value;

    public void SetCell(int row, int col, char value) => _grid[CellCoord.ToIndex(row, col)] = value;

    public ushort GetCandidatesMask(int index)
    {
        if (_grid[index] != BoardConstants.EmptyCellChar)
        {
            return 0;
        }

        int mask = 0x1FF; // 9 bits set (1..9)
        foreach (int peer in Regions.Peers[index])
        {
            char peerVal = _grid[peer];
            if (peerVal != BoardConstants.EmptyCellChar)
            {
                int bit = 1 << (peerVal - '1');
                mask &= ~bit;
            }
        }

        return (ushort)mask;
    }

    public int CountCandidates(int index) =>
        BitOperations.PopCount(GetCandidatesMask(index));

    public bool IsComplete()
    {
        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            if (_grid[i] == BoardConstants.EmptyCellChar)
            {
                return false;
            }
        }
        return true;
    }

    public bool IsValid()
    {
        for (int i = 0; i < BoardConstants.GridSize; i++)
        {
            if (HasDuplicates(Regions.RowCells[i]) ||
                HasDuplicates(Regions.ColCells[i]) ||
                HasDuplicates(Regions.RegionCells[i]))
            {
                return false;
            }
        }
        return true;
    }

    public bool IsSolved() => IsComplete() && IsValid();

    public override string ToString() => new(_grid);

    private bool HasDuplicates(int[] indices)
    {
        int seen = 0;
        foreach (int idx in indices)
        {
            char c = _grid[idx];
            if (c == BoardConstants.EmptyCellChar) continue;

            int bit = 1 << (c - '1');
            if ((seen & bit) != 0) return true;
            seen |= bit;
        }
        return false;
    }
}
