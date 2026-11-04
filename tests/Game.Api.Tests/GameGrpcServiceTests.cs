namespace Game.Api.Tests;

using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Game.Api.Data;
using Game.Api.Data.Repositories;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Exceptions;
using Game.Api.Domain.Services;
using Game.Api.Grpc;
using global::Grpc.Core;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Sudoku.Core;
using Sudoku.Game.V1;
using Xunit;

public class GameGrpcServiceTests
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

    private (GameGrpcService service, GameDbContext db) CreateGrpcService(string dbName)
    {
        var options = new DbContextOptionsBuilder<GameDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        var db = new GameDbContext(options);

        db.Levels.Add(new Level
        {
            LevelId = "easy",
            Name = "Easy",
            SortOrder = 1,
            MinClues = 38,
            MaxClues = 42,
            MaxMistakes = 3,
            MaxHints = 3,
            IsActive = true
        });

        db.Puzzles.Add(new Puzzle
        {
            Id = Guid.NewGuid(),
            LevelId = "easy",
            LayoutType = 1,
            InitialBoard = KnownPuzzle,
            SolutionBoard = ExpectedSolution,
            RegionMap = BoardConstants.StandardRegionMap,
            PuzzleHash = "hash123",
            ClueCount = 38,
            DifficultyScore = 100,
            IsLogicSolvable = true,
            IsActive = true,
            PlayCount = 0
        });

        db.SaveChanges();

        var sessionRepo = new GameSessionRepository(db);
        var levelRepo = new LevelRepository(db);
        var puzzleRepo = new PuzzleRepository(db);
        var uow = new UnitOfWork(db);
        var rulePolicy = new ClassicSoloRulePolicy();
        var puzzleBank = new PuzzleBankService(puzzleRepo, NullLogger<PuzzleBankService>.Instance);
        var gamePlayService = new GamePlayService(sessionRepo, levelRepo, puzzleBank, rulePolicy, uow, NullLogger<GamePlayService>.Instance);
        var leaderboardService = new LeaderboardService(levelRepo, sessionRepo);

        var service = new GameGrpcService(gamePlayService, leaderboardService);
        return (service, db);
    }

    private ServerCallContext CreateCallContext(string? userId = null)
    {
        var httpContext = new DefaultHttpContext();
        if (!string.IsNullOrEmpty(userId))
        {
            var identity = new ClaimsIdentity(new[] { new Claim("sub", userId) }, "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
        }

        return new TestServerCallContext(httpContext);
    }

    [Fact]
    public async Task ListLevels_ReturnsSeededLevels()
    {
        var (service, _) = CreateGrpcService(nameof(ListLevels_ReturnsSeededLevels));
        var context = CreateCallContext();

        var response = await service.ListLevels(new ListLevelsRequest(), context);

        Assert.NotEmpty(response.Levels);
        Assert.Equal("easy", response.Levels[0].LevelId);
        Assert.Equal(3, response.Levels[0].MaxMistakes);
    }

    [Fact]
    public async Task StartGame_WithAuthenticatedUser_ReturnsSessionState()
    {
        var (service, _) = CreateGrpcService(nameof(StartGame_WithAuthenticatedUser_ReturnsSessionState));
        var context = CreateCallContext(userId: "user-grpc-1");

        var response = await service.StartGame(new StartGameRequest
        {
            LevelId = "easy",
            LayoutType = LayoutType.Standard
        }, context);

        Assert.NotNull(response.Session);
        Assert.Equal("easy", response.Session.LevelId);
        Assert.Equal(SessionStatus.InProgress, response.Session.Status);
        Assert.Equal(3, response.Session.MaxMistakes);
        Assert.Equal(3, response.Session.MaxHints);
    }

    [Fact]
    public async Task StartGame_Unauthenticated_ThrowsRpcException()
    {
        var (service, _) = CreateGrpcService(nameof(StartGame_Unauthenticated_ThrowsRpcException));
        var context = CreateCallContext(userId: null); // No user claim

        var ex = await Assert.ThrowsAsync<RpcException>(() =>
            service.StartGame(new StartGameRequest { LevelId = "easy" }, context));

        Assert.Equal(StatusCode.Unauthenticated, ex.StatusCode);
    }

    [Fact]
    public async Task MakeMove_InvalidGuidFormat_ThrowsValidationException()
    {
        var (service, _) = CreateGrpcService(nameof(MakeMove_InvalidGuidFormat_ThrowsValidationException));
        var context = CreateCallContext(userId: "user-grpc-1");

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.MakeMove(new MakeMoveRequest
            {
                SessionId = "not-a-guid",
                Row = 0,
                Col = 0,
                Value = 1
            }, context));
    }

    private class TestServerCallContext : ServerCallContext
    {
        private readonly HttpContext _httpContext;

        public TestServerCallContext(HttpContext httpContext)
        {
            _httpContext = httpContext;
        }

        protected override string MethodCore => "/sudoku.game.v1.GameService/TestMethod";
        protected override string HostCore => "localhost";
        protected override string PeerCore => "127.0.0.1";
        protected override DateTime DeadlineCore => DateTime.UtcNow.AddMinutes(1);
        protected override Metadata RequestHeadersCore => new Metadata();
        protected override CancellationToken CancellationTokenCore => CancellationToken.None;
        protected override Metadata ResponseTrailersCore => new Metadata();
        protected override Status StatusCore { get; set; }
        protected override WriteOptions? WriteOptionsCore { get; set; }
        protected override AuthContext AuthContextCore => null!;

        protected override ContextPropagationToken CreatePropagationTokenCore(ContextPropagationOptions? options) => null!;
        protected override Task WriteResponseHeadersAsyncCore(Metadata responseHeaders) => Task.CompletedTask;

        protected override IDictionary<object, object> UserStateCore =>
            new Dictionary<object, object> { { "__HttpContext", _httpContext } };
    }

}
