namespace Sudoku.Core;

using System;
using System.Security.Cryptography;
using System.Text;

/// <summary>
/// Cung cấp các phép biến đổi đẳng hình (Sudoku Isomorphism Transformations)
/// giúp tạo ra các bàn cờ biến thể hoàn toàn mới từ một bàn cờ gốc mà vẫn
/// bảo toàn 100% tính hợp lệ, độ khó và tính duy nhất của nghiệm.
/// </summary>
public static class SudokuTransformer
{
    /// <summary>
    /// Hoán vị ngẫu nhiên 9 chữ số ('1'..'9') trên cả bàn cờ đề và bàn cờ đáp án.
    /// Có 9! = 362.880 cách hoán vị. Áp dụng được cho mọi bố cục (Standard lẫn Irregular).
    /// </summary>
    public static (string TransformedInitial, string TransformedSolution) ApplyDigitPermutation(
        string initialBoard,
        string solutionBoard,
        Random? rng = null)
    {
        if (string.IsNullOrEmpty(initialBoard) || initialBoard.Length != BoardConstants.CellCount)
        {
            throw new ArgumentException($"Initial board must have {BoardConstants.CellCount} characters.", nameof(initialBoard));
        }

        if (string.IsNullOrEmpty(solutionBoard) || solutionBoard.Length != BoardConstants.CellCount)
        {
            throw new ArgumentException($"Solution board must have {BoardConstants.CellCount} characters.", nameof(solutionBoard));
        }

        rng ??= Random.Shared;

        // 1. Tạo hoán vị ngẫu nhiên của 9 số ('1'..'9')
        char[] digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        rng.Shuffle(digits);

        // 2. Tạo bảng ánh xạ: map['1'] -> digits[0], ..., map['9'] -> digits[8]
        char[] map = new char[10];
        for (int i = 0; i < 9; i++)
        {
            map[i + 1] = digits[i];
        }

        // 3. Áp dụng ánh xạ cho cả InitialBoard và SolutionBoard
        char[] newInit = initialBoard.ToCharArray();
        char[] newSol = solutionBoard.ToCharArray();

        for (int i = 0; i < BoardConstants.CellCount; i++)
        {
            char cInit = newInit[i];
            if (cInit >= '1' && cInit <= '9')
            {
                newInit[i] = map[cInit - '0'];
            }

            char cSol = newSol[i];
            if (cSol >= '1' && cSol <= '9')
            {
                newSol[i] = map[cSol - '0'];
            }
        }

        return (new string(newInit), new string(newSol));
    }

    /// <summary>
    /// Xoay bàn cờ theo chiều kim đồng hồ n lần (mỗi lần 90 độ).
    /// </summary>
    public static string Rotate(string board, int rotations)
    {
        if (string.IsNullOrEmpty(board) || board.Length != BoardConstants.CellCount)
        {
            throw new ArgumentException($"Board must have {BoardConstants.CellCount} characters.", nameof(board));
        }

        rotations = (rotations % 4 + 4) % 4;
        if (rotations == 0) return board;

        char[] current = board.ToCharArray();
        for (int r = 0; r < rotations; r++)
        {
            char[] next = new char[BoardConstants.CellCount];
            for (int row = 0; row < BoardConstants.GridSize; row++)
            {
                for (int col = 0; col < BoardConstants.GridSize; col++)
                {
                    // Ô (row, col) xoay 90 độ sẽ sang ô (col, 8 - row)
                    int oldIndex = row * BoardConstants.GridSize + col;
                    int newIndex = col * BoardConstants.GridSize + (BoardConstants.GridSize - 1 - row);
                    next[newIndex] = current[oldIndex];
                }
            }
            current = next;
        }

        return new string(current);
    }

    /// <summary>
    /// Lật gương bàn cờ (ngang hoặc dọc).
    /// </summary>
    public static string Reflect(string board, bool horizontal)
    {
        if (string.IsNullOrEmpty(board) || board.Length != BoardConstants.CellCount)
        {
            throw new ArgumentException($"Board must have {BoardConstants.CellCount} characters.", nameof(board));
        }

        char[] result = new char[BoardConstants.CellCount];
        for (int row = 0; row < BoardConstants.GridSize; row++)
        {
            for (int col = 0; col < BoardConstants.GridSize; col++)
            {
                int oldIndex = row * BoardConstants.GridSize + col;
                int newRow = horizontal ? (BoardConstants.GridSize - 1 - row) : row;
                int newCol = horizontal ? col : (BoardConstants.GridSize - 1 - col);
                int newIndex = newRow * BoardConstants.GridSize + newCol;
                result[newIndex] = board[oldIndex];
            }
        }

        return new string(result);
    }

    /// <summary>
    /// Biến đổi toàn diện cho bàn cờ Standard (kết hợp ngẫu nhiên Xoay + Lật gương + Hoán vị 9 chữ số).
    /// </summary>
    public static (string TransformedInitial, string TransformedSolution) TransformStandard(
        string initialBoard,
        string solutionBoard,
        Random? rng = null)
    {
        rng ??= Random.Shared;

        // 1. Xoay ngẫu nhiên (0, 90, 180, hoặc 270 độ)
        int rotations = rng.Next(0, 4);
        string initRotated = Rotate(initialBoard, rotations);
        string solRotated = Rotate(solutionBoard, rotations);

        // 2. Lật gương ngẫu nhiên
        int reflectChoice = rng.Next(0, 3); // 0: không lật, 1: ngang, 2: dọc
        if (reflectChoice == 1)
        {
            initRotated = Reflect(initRotated, horizontal: true);
            solRotated = Reflect(solRotated, horizontal: true);
        }
        else if (reflectChoice == 2)
        {
            initRotated = Reflect(initRotated, horizontal: false);
            solRotated = Reflect(solRotated, horizontal: false);
        }

        // 3. Hoán vị ngẫu nhiên 9 chữ số
        return ApplyDigitPermutation(initRotated, solRotated, rng);
    }

    /// <summary>
    /// Tính mã băm SHA256 tương thích với Puzzle.PuzzleHash trong hệ thống.
    /// </summary>
    public static string ComputePuzzleHash(string initialBoard, string regionMap)
    {
        string raw = $"{initialBoard}|{regionMap}";
        byte[] bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
