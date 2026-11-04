namespace Game.Api.Domain.Services;

using System;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Domain.Entities;
using Microsoft.Extensions.Logging;
using Sudoku.Core;

public interface IPuzzleBankService
{
    Task<Puzzle> GetOrCreateUnplayedPuzzleAsync(Level level, int layoutType, string userId, CancellationToken ct = default);
    Task<int> ReplenishBufferAsync(Level level, int layoutType, int targetBuffer, CancellationToken ct = default);
}

public class PuzzleBankService : IPuzzleBankService
{
    private readonly IPuzzleRepository _puzzleRepo;
    private readonly ILogger<PuzzleBankService> _logger;

    public PuzzleBankService(IPuzzleRepository puzzleRepo, ILogger<PuzzleBankService> logger)
    {
        _puzzleRepo = puzzleRepo;
        _logger = logger;
    }

    public async Task<Puzzle> GetOrCreateUnplayedPuzzleAsync(Level level, int layoutType, string userId, CancellationToken ct = default)
    {
        // 1. Try to fetch an existing puzzle from the bank that this user has never played
        var existingPuzzle = await _puzzleRepo.GetUnplayedPuzzleAsync(level.LevelId, layoutType, userId, ct);
        if (existingPuzzle != null)
        {
            existingPuzzle.PlayCount++;
            return existingPuzzle;
        }

        // 2. If no unplayed puzzle exists in DB for this user, generate one on-the-fly!
        _logger.LogInformation("Generating on-the-fly puzzle for level {LevelId}, layout {LayoutType}, user {UserId}",
            level.LevelId, layoutType, userId);

        var generated = SudokuGenerator.Generate(
            RegionMap.Standard,
            level.MinClues,
            level.MaxClues
        );

        var newPuzzle = new Puzzle
        {
            Id = Guid.NewGuid(),
            LevelId = level.LevelId,
            LayoutType = layoutType,
            InitialBoard = generated.InitialBoard,
            SolutionBoard = generated.SolutionBoard,
            RegionMap = generated.RegionMap,
            PuzzleHash = generated.PuzzleHash,
            ClueCount = generated.ClueCount,
            DifficultyScore = (BoardConstants.CellCount - generated.ClueCount) * 10,
            IsLogicSolvable = true,
            IsActive = true,
            GeneratorVersion = 1,
            PlayCount = 1,
            CreatedAt = DateTime.UtcNow
        };

        _puzzleRepo.Add(newPuzzle);
        return newPuzzle;
    }

    public async Task<int> ReplenishBufferAsync(Level level, int layoutType, int targetBuffer, CancellationToken ct = default)
    {
        int unplayedCount = await _puzzleRepo.CountUnplayedPuzzlesAsync(level.LevelId, layoutType, ct);
        int needed = targetBuffer - unplayedCount;
        if (needed <= 0)
        {
            return 0;
        }

        int generatedCount = 0;
        int maxAttempts = needed * 2;

        for (int i = 0; i < maxAttempts && generatedCount < needed; i++)
        {
            if (ct.IsCancellationRequested) break;

            var generated = SudokuGenerator.Generate(
                RegionMap.Standard,
                level.MinClues,
                level.MaxClues
            );

            bool exists = await _puzzleRepo.ExistsHashAsync(generated.PuzzleHash, ct);
            if (!exists)
            {
                var puzzle = new Puzzle
                {
                    Id = Guid.NewGuid(),
                    LevelId = level.LevelId,
                    LayoutType = layoutType,
                    InitialBoard = generated.InitialBoard,
                    SolutionBoard = generated.SolutionBoard,
                    RegionMap = generated.RegionMap,
                    PuzzleHash = generated.PuzzleHash,
                    ClueCount = generated.ClueCount,
                    DifficultyScore = (BoardConstants.CellCount - generated.ClueCount) * 10,
                    IsLogicSolvable = true,
                    IsActive = true,
                    GeneratorVersion = 1,
                    PlayCount = 0,
                    CreatedAt = DateTime.UtcNow
                };

                _puzzleRepo.Add(puzzle);
                generatedCount++;
            }
        }

        return generatedCount;
    }
}
