namespace Sudoku.Core;

using System;
using System.Collections.Generic;
using System.Linq;

public sealed class RegionMap
{
    private static readonly Lazy<RegionMap> StandardInstance = new(() => new RegionMap(BoardConstants.StandardRegionMap));
    private static readonly Lazy<RegionMap> IrregularInstance = new(() => new RegionMap(BoardConstants.IrregularRegionMap));

    public static RegionMap Standard => StandardInstance.Value;
    public static RegionMap Irregular => IrregularInstance.Value;

    public static RegionMap GetForLayout(int layoutType) =>
        layoutType == 2 ? Irregular : Standard;

    public string MapString { get; }
    public int[] CellRegion { get; } = new int[BoardConstants.CellCount];
    public int[][] RegionCells { get; } = new int[BoardConstants.RegionCount][];
    public int[][] RowCells { get; } = new int[BoardConstants.GridSize][];
    public int[][] ColCells { get; } = new int[BoardConstants.GridSize][];
    public int[][] Peers { get; } = new int[BoardConstants.CellCount][];

    public RegionMap(string mapString)
    {
        if (string.IsNullOrWhiteSpace(mapString) || mapString.Length != BoardConstants.CellCount)
        {
            throw new ArgumentException($"Region map must be exactly {BoardConstants.CellCount} characters long.", nameof(mapString));
        }

        var regionCellLists = new List<int>[BoardConstants.RegionCount];
        for (int r = 0; r < BoardConstants.RegionCount; r++)
        {
            regionCellLists[r] = new List<int>(BoardConstants.GridSize);
        }

        var rowCellLists = new List<int>[BoardConstants.GridSize];
        var colCellLists = new List<int>[BoardConstants.GridSize];
        for (int i = 0; i < BoardConstants.GridSize; i++)
        {
            rowCellLists[i] = new List<int>(BoardConstants.GridSize);
            colCellLists[i] = new List<int>(BoardConstants.GridSize);
        }

        for (int idx = 0; idx < BoardConstants.CellCount; idx++)
        {
            char ch = mapString[idx];
            if (ch < '0' || ch > '8')
            {
                throw new ArgumentException($"Invalid region character '{ch}' at index {idx}. Must be '0'..'8'.", nameof(mapString));
            }

            int region = ch - '0';
            CellRegion[idx] = region;
            regionCellLists[region].Add(idx);

            int row = CellCoord.ToRow(idx);
            int col = CellCoord.ToCol(idx);
            rowCellLists[row].Add(idx);
            colCellLists[col].Add(idx);
        }

        for (int r = 0; r < BoardConstants.RegionCount; r++)
        {
            if (regionCellLists[r].Count != BoardConstants.GridSize)
            {
                throw new ArgumentException($"Region {r} has {regionCellLists[r].Count} cells; expected exactly {BoardConstants.GridSize}.", nameof(mapString));
            }

            RegionCells[r] = regionCellLists[r].ToArray();
            if (!IsConnected(RegionCells[r]))
            {
                throw new ArgumentException($"Region {r} is not orthogonally connected.", nameof(mapString));
            }
        }

        for (int i = 0; i < BoardConstants.GridSize; i++)
        {
            RowCells[i] = rowCellLists[i].ToArray();
            ColCells[i] = colCellLists[i].ToArray();
        }

        for (int idx = 0; idx < BoardConstants.CellCount; idx++)
        {
            int row = CellCoord.ToRow(idx);
            int col = CellCoord.ToCol(idx);
            int reg = CellRegion[idx];

            var peerSet = new HashSet<int>(24);
            foreach (int c in RowCells[row]) if (c != idx) peerSet.Add(c);
            foreach (int c in ColCells[col]) if (c != idx) peerSet.Add(c);
            foreach (int c in RegionCells[reg]) if (c != idx) peerSet.Add(c);

            Peers[idx] = peerSet.OrderBy(x => x).ToArray();
        }

        MapString = mapString;
    }

    public static bool IsConnected(IReadOnlyList<int> cells)
    {
        if (cells == null || cells.Count == 0) return false;
        if (cells.Count == 1) return true;

        var cellSet = new HashSet<int>(cells);
        var visited = new HashSet<int>(cells.Count);
        var queue = new Queue<int>();

        int start = cells[0];
        visited.Add(start);
        queue.Enqueue(start);

        Span<(int dr, int dc)> deltas = stackalloc (int, int)[] { (-1, 0), (1, 0), (0, -1), (0, 1) };
        while (queue.Count > 0)
        {
            int current = queue.Dequeue();
            int r = CellCoord.ToRow(current);
            int c = CellCoord.ToCol(current);

            foreach (var (dr, dc) in deltas)
            {
                int nr = r + dr;
                int nc = c + dc;
                if (!CellCoord.IsValidCoord(nr, nc)) continue;

                int neighbor = CellCoord.ToIndex(nr, nc);
                if (cellSet.Contains(neighbor) && visited.Add(neighbor))
                {
                    queue.Enqueue(neighbor);
                }
            }
        }

        return visited.Count == cells.Count;
    }
}
