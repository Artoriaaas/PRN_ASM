namespace Sudoku.Core;

public static class CellCoord
{
    public static int ToIndex(int row, int col) => row * BoardConstants.GridSize + col;

    public static int ToRow(int index) => index / BoardConstants.GridSize;

    public static int ToCol(int index) => index % BoardConstants.GridSize;

    public static bool IsValidCoord(int row, int col) =>
        row >= 0 && row < BoardConstants.GridSize && col >= 0 && col < BoardConstants.GridSize;

    public static bool IsValidIndex(int index) =>
        index >= 0 && index < BoardConstants.CellCount;

    public static bool IsValidDigit(int value) =>
        value >= 1 && value <= 9;
}
