namespace Support.Api.Contracts;

using System;
using System.Collections.Generic;

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages
);

public sealed record TutorialQueryParams(
    string? Search = null,
    string? Category = null,
    string? Difficulty = null,
    bool? IsPublished = null,
    string? SortBy = "sortOrder",
    string? SortDir = "asc",
    int Page = 1,
    int PageSize = 10
);

public sealed record TutorialDto(
    Guid Id,
    string Title,
    string Summary,
    string Content,
    string Category,
    string Difficulty,
    int SortOrder,
    bool IsPublished,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public sealed record CreateTutorialRequest(
    string Title,
    string Summary,
    string Content,
    string Category,
    string Difficulty,
    int SortOrder,
    bool IsPublished = true
);

public sealed record UpdateTutorialRequest(
    string Title,
    string Summary,
    string Content,
    string Category,
    string Difficulty,
    int SortOrder,
    bool IsPublished
);

public sealed record NoticeQueryParams(
    string? Search = null,
    string? Category = null,
    bool? IsPinned = null,
    string? SortBy = "publishedAt",
    string? SortDir = "desc",
    int Page = 1,
    int PageSize = 10
);

public sealed record SystemNoticeDto(
    Guid Id,
    string Title,
    string Content,
    string Category,
    bool IsPinned,
    DateTime PublishedAt,
    DateTime CreatedAt
);

public sealed record CreateNoticeRequest(
    string Title,
    string Content,
    string Category,
    bool IsPinned = false
);

public sealed record UpdateNoticeRequest(
    string Title,
    string Content,
    string Category,
    bool IsPinned
);

public sealed record PortalGameOverviewDto(
    IReadOnlyList<LevelSummaryDto> Levels,
    string RequestedLevelId,
    IReadOnlyList<LeaderboardEntryDto> Leaderboard,
    PlayerProfileSummaryDto? CurrentUser
);

public sealed record LevelSummaryDto(
    string LevelId,
    string Name,
    int SortOrder,
    int MinClues,
    int MaxClues,
    int MaxMistakes,
    int MaxHints
);

public sealed record LeaderboardEntryDto(
    int Rank,
    string UserId,
    string PlayerName,
    int Score,
    long ElapsedMs
);

public sealed record PlayerProfileSummaryDto(
    string Id,
    string DisplayName,
    string Email,
    string AvatarUrl,
    int TotalGames,
    int Wins,
    int PlayerLevel,
    int Trophies
);
