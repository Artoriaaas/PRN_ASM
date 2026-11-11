namespace Support.Api.Controllers;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Sudoku.Game.V1;
using Sudoku.User.V1;
using Support.Api.Contracts;

[ApiController]
[Route("api/v1/portal")]
public sealed class PortalController(
    GameService.GameServiceClient gameClient,
    UserService.UserServiceClient userClient,
    ILogger<PortalController> logger) : ControllerBase
{
    /// <summary>
    /// Minh họa tương tác giữa REST API và gRPC Service (Mục 2.4 đề bài):
    /// Endpoint REST này gọi gRPC sang GameService (lấy Levels và HighScores)
    /// và UserService (lấy Profile người dùng hiện tại nếu có JWT).
    /// </summary>
    [HttpGet("game-overview")]
    [AllowAnonymous]
    public async Task<ActionResult<PortalGameOverviewDto>> GetGameOverview(
        [FromQuery] string levelId = "easy",
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var safeLevelId = string.IsNullOrWhiteSpace(levelId) ? "easy" : levelId.Trim().ToLowerInvariant();
        var safeLimit = Math.Clamp(limit <= 0 ? 10 : limit, 1, 50);

        var levelsList = new List<LevelSummaryDto>();
        var leaderboardList = new List<LeaderboardEntryDto>();
        PlayerProfileSummaryDto? currentUserProfile = null;

        try
        {
            var levelsResponse = await gameClient.ListLevelsAsync(
                new ListLevelsRequest(),
                deadline: DateTime.UtcNow.AddSeconds(3),
                cancellationToken: ct);

            foreach (var l in levelsResponse.Levels)
            {
                levelsList.Add(new LevelSummaryDto(
                    l.LevelId, l.Name, l.SortOrder, l.MinClues, l.MaxClues, l.MaxMistakes, l.MaxHints));
            }
        }
        catch (RpcException ex)
        {
            logger.LogWarning(ex, "Gọi gRPC sang GameService.ListLevels thất bại: {Detail}", ex.Status.Detail);
        }

        try
        {
            var scoresResponse = await gameClient.GetHighScoresAsync(
                new GetHighScoresRequest
                {
                    LevelId = safeLevelId,
                    LayoutType = LayoutType.Standard,
                    Limit = safeLimit
                },
                deadline: DateTime.UtcNow.AddSeconds(3),
                cancellationToken: ct);

            foreach (var entry in scoresResponse.Entries)
            {
                leaderboardList.Add(new LeaderboardEntryDto(
                    entry.Rank,
                    entry.UserId,
                    string.IsNullOrWhiteSpace(entry.PlayerName) ? "Anonymous" : entry.PlayerName,
                    entry.Score,
                    entry.ElapsedMs));
            }
        }
        catch (RpcException ex)
        {
            logger.LogWarning(ex, "Gọi gRPC sang GameService.GetHighScores thất bại: {Detail}", ex.Status.Detail);
        }

        if (Request.Headers.TryGetValue("Authorization", out var authHeader) && !string.IsNullOrWhiteSpace(authHeader))
        {
            try
            {
                var headers = new Metadata { { "authorization", authHeader.ToString() } };
                var profileResponse = await userClient.GetProfileAsync(
                    new GetProfileRequest(),
                    headers: headers,
                    deadline: DateTime.UtcNow.AddSeconds(3),
                    cancellationToken: ct);

                var p = profileResponse.Profile;
                if (p != null)
                {
                    currentUserProfile = new PlayerProfileSummaryDto(
                        p.Id, p.DisplayName, p.Email, p.AvatarUrl, p.TotalGames, p.Wins, p.PlayerLevel, p.Trophies);
                }
            }
            catch (RpcException ex)
            {
                logger.LogInformation("Không lấy được profile từ UserService (token có thể chưa đăng ký hoặc hết hạn): {Detail}", ex.Status.Detail);
            }
        }

        return Ok(new PortalGameOverviewDto(levelsList, safeLevelId, leaderboardList, currentUserProfile));
    }
}
