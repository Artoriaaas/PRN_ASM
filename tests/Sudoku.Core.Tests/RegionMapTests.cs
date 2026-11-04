namespace Sudoku.Core.Tests;

using System;
using Xunit;

public class RegionMapTests
{
    [Fact]
    public void StandardRegionMap_IsValid_AndEveryCellHas20Peers()
    {
        var map = RegionMap.Standard;

        Assert.Equal(BoardConstants.CellCount, map.CellRegion.Length);
        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            Assert.Equal(20, map.Peers[i].Length);
            Assert.DoesNotContain(i, map.Peers[i]);
        }
    }

    [Fact]
    public void RegionMap_DisconnectedRegion_ThrowsArgumentException()
    {
        // Construct a map where region 0 is disconnected (split across opposite corners)
        char[] chars = BoardConstants.StandardRegionMap.ToCharArray();
        // swap cell 0 (region 0) with cell 80 (region 8)
        char temp = chars[0];
        chars[0] = chars[80];
        chars[80] = temp;

        string broken = new(chars);
        Assert.Throws<ArgumentException>(() => new RegionMap(broken));
    }

    [Fact]
    public void CellCoord_Conversions_AreAccurate()
    {
        for (int r = 0; r < 9; r++)
        {
            for (int c = 0; c < 9; c++)
            {
                int idx = CellCoord.ToIndex(r, c);
                Assert.Equal(r, CellCoord.ToRow(idx));
                Assert.Equal(c, CellCoord.ToCol(idx));
            }
        }
    }
}
