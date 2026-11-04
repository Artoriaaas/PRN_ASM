namespace Game.Api.Tests;

using System;
using System.Linq;
using System.Threading.Tasks;
using Game.Api.Data;
using Game.Api.Data.Repositories;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Exceptions;
using Game.Api.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Sudoku.Core;
using Xunit;

public class GamePlayServiceTests
{
    private const string KnownPuzzle =
        "530070000" +
        "600195000" +
        "098000060" +
        "800060003" +
        "400803001" +
        "700020006" +
        "060000280" +
        "000419005" +
        "000080079";

    private const string ExpectedSolution =
        "534678912" +
        "672195348" +
        "198342567" +
        "859761423" +
        "426853791" +
        "713924856" +
        "961537284" +
        "287419635" +
        "345286179";

    private GameDbContext CreateContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<GameDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new GameDbContext(options);
    }

    private async Task<(GamePlayService service, GameDbContext db)> CreateServiceAsync(string dbName)
    {
        var db = CreateContext(dbName);

        var level = new Level
        {
            LevelId = "easy",
            Name = "Easy",
            SortOrder = 1,
            MinClues = 38,
            MaxClues = 42,
            MaxMistakes = 3,
            MaxHints = 3,
            IsActive = true
        };
        db.Levels.Add(level);

        var puzzle = new Puzzle
        {
            Id = Guid.NewGuid(),
            LevelId = "easy",
            LayoutType = 1,
            InitialBoard = KnownPuzzle,
            SolutionBoard = ExpectedSolution,
            RegionMap = BoardConstants.StandardRegionMap,
            PuzzleHash = "testhash12345",
            ClueCount = 38,
            DifficultyScore = 100,
            IsLogicSolvable = true,
            IsActive = true,
            PlayCount = 0
        };
        db.Puzzles.Add(puzzle);
        await db.SaveChangesAsync();

        var sessionRepo = new GameSessionRepository(db);
        var levelRepo = new LevelRepository(db);
        var puzzleRepo = new PuzzleRepository(db);
        var uow = new UnitOfWork(db);
        var rulePolicy = new ClassicSoloRulePolicy();
        var puzzleBank = new PuzzleBankService(puzzleRepo, NullLogger<PuzzleBankService>.Instance);

        var service = new GamePlayService(
            sessionRepo,
            levelRepo,
            puzzleBank,
            rulePolicy,
            uow,
            NullLogger<GamePlayService>.Instance
        );

        return (service, db);
    }

    [Fact]
    public async Task StartGame_CreatesSession_AndAbandonsPreviousActiveSession()
    {
        var (service, db) = await CreateServiceAsync(nameof(StartGame_CreatesSession_AndAbandonsPreviousActiveSession));
        const string userId = "user-123";

        var session1 = await service.StartGameAsync(userId, "easy", layoutType: 1);
        Assert.Equal(1, session1.Status); // InProgress

        var session2 = await service.StartGameAsync(userId, "easy", layoutType: 1);
        Assert.Equal(1, session2.Status); // InProgress
        Assert.NotEqual(session1.Id, session2.Id);

        var reloaded1 = await db.GameSessions.FindAsync(session1.Id);
        Assert.NotNull(reloaded1);
        Assert.Equal(4, reloaded1.Status); // Abandoned

        // Outbox should contain game finished event for the abandoned session
        Assert.Contains(db.OutboxMessages, m => m.UserId == userId && m.Type == "GameFinished");
    }

    [Fact]
    public async Task MakeMove_CorrectMove_AwardsPoints_AndUpdatesBoard()
    {
        var (service, db) = await CreateServiceAsync(nameof(MakeMove_CorrectMove_AwardsPoints_AndUpdatesBoard));
        var session = await service.StartGameAsync("user-correct", "easy", 1);

        // Cell (0, 2) is '0' in KnownPuzzle, '4' in ExpectedSolution
        var (eval, updatedSession) = await service.MakeMoveAsync("user-correct", session.Id, row: 0, col: 2, value: 4);

        Assert.True(eval.IsCorrect);
        Assert.True(eval.PointsDelta > 0);
        Assert.Equal('4', updatedSession.CurrentBoard[2]);
        Assert.Equal(eval.PointsDelta, updatedSession.Score);
        Assert.Equal(1, updatedSession.CorrectMoveCount);
        Assert.Equal(1.0, updatedSession.Accuracy);
    }

    [Fact]
    public async Task MakeMove_ThreeMistakes_FailsGame_AndWritesOutbox()
    {
        var (service, db) = await CreateServiceAsync(nameof(MakeMove_ThreeMistakes_FailsGame_AndWritesOutbox));
        var session = await service.StartGameAsync("user-fail", "easy", 1);

        // Solution at (0, 2) is 4. Submit 9, 8, 7
        await service.MakeMoveAsync("user-fail", session.Id, 0, 2, 9);
        await service.MakeMoveAsync("user-fail", session.Id, 0, 2, 8);
        var (_, failedSession) = await service.MakeMoveAsync("user-fail", session.Id, 0, 2, 7);

        Assert.Equal(3, failedSession.MistakesCount);
        Assert.Equal(3, failedSession.Status); // Failed
        Assert.NotNull(failedSession.FinishedAt);

        var outboxMsg = db.OutboxMessages.FirstOrDefault(m => m.UserId == "user-fail" && m.Type == "GameFinished");
        Assert.NotNull(outboxMsg);
    }

    [Fact]
    public async Task MakeMove_DuplicateWrongMove_DoesNotPenalizeTwice()
    {
        var (service, _) = await CreateServiceAsync(nameof(MakeMove_DuplicateWrongMove_DoesNotPenalizeTwice));
        var session = await service.StartGameAsync("user-dup", "easy", 1);

        // First wrong move
        var (firstEval, sessionAfterFirst) = await service.MakeMoveAsync("user-dup", session.Id, 0, 2, 9);
        Assert.False(firstEval.IsCorrect);
        Assert.False(firstEval.IsDuplicateWrong);
        Assert.Equal(1, sessionAfterFirst.MistakesCount);
        Assert.Equal(-5, firstEval.PointsDelta);

        // Second wrong move: same cell, same wrong value
        var (secondEval, sessionAfterSecond) = await service.MakeMoveAsync("user-dup", session.Id, 0, 2, 9);
        Assert.False(secondEval.IsCorrect);
        Assert.True(secondEval.IsDuplicateWrong);
        Assert.Equal(1, sessionAfterSecond.MistakesCount); // Mistakes count unchanged!
        Assert.Equal(0, secondEval.PointsDelta); // 0 points penalty!
    }

    [Fact]
    public async Task MakeMove_OnGivenCell_ThrowsValidationException()
    {
        var (service, _) = await CreateServiceAsync(nameof(MakeMove_OnGivenCell_ThrowsValidationException));
        var session = await service.StartGameAsync("user-given", "easy", 1);

        // Cell (0, 0) is given '5'
        await Assert.ThrowsAsync<ValidationException>(() =>
            service.MakeMoveAsync("user-given", session.Id, row: 0, col: 0, value: 5));
    }

    [Fact]
    public async Task UseHint_FillsCorrectValue_IncrementsHintsUsed_AndLimitsAtThree()
    {
        var (service, _) = await CreateServiceAsync(nameof(UseHint_FillsCorrectValue_IncrementsHintsUsed_AndLimitsAtThree));
        var session = await service.StartGameAsync("user-hint", "easy", 1);

        // Hint 1
        var (hint1, s1) = await service.UseHintAsync("user-hint", session.Id, targetRow: 0, targetCol: 2);
        Assert.Equal(4, hint1.Value);
        Assert.Equal('4', s1.CurrentBoard[2]);
        Assert.Equal(1, s1.HintsUsed);

        // Hint 2 & 3
        await service.UseHintAsync("user-hint", session.Id, null, null);
        await service.UseHintAsync("user-hint", session.Id, null, null);

        // Hint 4 should fail because max hints is 3
        await Assert.ThrowsAsync<InvalidStateException>(() =>
            service.UseHintAsync("user-hint", session.Id, null, null));
    }

    [Fact]
    public async Task AbandonGame_SetsStatusAbandoned_AndPublishesOutbox()
    {
        var (service, db) = await CreateServiceAsync(nameof(AbandonGame_SetsStatusAbandoned_AndPublishesOutbox));
        var session = await service.StartGameAsync("user-abandon", "easy", 1);

        var abandoned = await service.AbandonGameAsync("user-abandon", session.Id);
        Assert.Equal(4, abandoned.Status); // Abandoned

        Assert.Contains(db.OutboxMessages, m => m.UserId == "user-abandon" && m.Type == "GameFinished");
    }
}
