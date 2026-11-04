namespace Game.Api.Tests;

using System;
using System.Threading.Tasks;
using Game.Api.Data;
using Game.Api.Data.Repositories;
using Game.Api.Domain.Entities;
using Game.Api.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

public class LeaderboardServiceTests
{
    private GameDbContext CreateContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<GameDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new GameDbContext(options);
    }

    [Fact]
    public async Task GetHighScores_ReturnsSingleBestScorePerUser_OrderedByScoreDesc()
    {
        var db = CreateContext(nameof(GetHighScores_ReturnsSingleBestScorePerUser_OrderedByScoreDesc));
        var levelRepo = new LevelRepository(db);
        var sessionRepo = new GameSessionRepository(db);
        var leaderboardService = new LeaderboardService(levelRepo, sessionRepo);

        // User A has 3 completed games: 500, 750, 600
        // User B has 1 completed game: 700
        // User C has 1 completed game on different level: 900
        db.GameSessions.AddRange(
            new GameSession { Id = Guid.NewGuid(), UserId = "UserA", LevelId = "hard", LayoutType = 1, Status = 2, Score = 500, ElapsedMs = 40000 },
            new GameSession { Id = Guid.NewGuid(), UserId = "UserA", LevelId = "hard", LayoutType = 1, Status = 2, Score = 750, ElapsedMs = 35000 },
            new GameSession { Id = Guid.NewGuid(), UserId = "UserA", LevelId = "hard", LayoutType = 1, Status = 2, Score = 600, ElapsedMs = 30000 },
            new GameSession { Id = Guid.NewGuid(), UserId = "UserB", LevelId = "hard", LayoutType = 1, Status = 2, Score = 700, ElapsedMs = 25000 },
            new GameSession { Id = Guid.NewGuid(), UserId = "UserC", LevelId = "easy", LayoutType = 1, Status = 2, Score = 900, ElapsedMs = 20000 }
        );
        await db.SaveChangesAsync();

        var highScores = await leaderboardService.GetHighScoresAsync("hard", layoutType: 1, limit: 10);

        Assert.Equal(2, highScores.Count);

        // Rank 1: UserA with 750 (single best score for UserA)
        Assert.Equal("UserA", highScores[0].UserId);
        Assert.Equal(750, highScores[0].Score);

        // Rank 2: UserB with 700
        Assert.Equal("UserB", highScores[1].UserId);
        Assert.Equal(700, highScores[1].Score);
    }
}
