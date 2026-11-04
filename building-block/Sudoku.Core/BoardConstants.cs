namespace Sudoku.Core;

public static class BoardConstants
{
    public const int GridSize = 9;
    public const int CellCount = 81;
    public const int BoxSize = 3;
    public const int RegionCount = 9;
    public const char EmptyCellChar = '0';

    /// <summary>
    /// Standard 9x9 Sudoku region map consisting of nine 3x3 blocks.
    /// Each character in 0..8 represents the region index for that cell.
    /// </summary>
    public const string StandardRegionMap =
        "000111222" +
        "000111222" +
        "000111222" +
        "333444555" +
        "333444555" +
        "333444555" +
        "666777888" +
        "666777888" +
        "666777888";
}
