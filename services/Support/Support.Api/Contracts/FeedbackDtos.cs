namespace Support.Api.Contracts;

using System;
using System.Collections.Generic;

public record SubmitFeedbackRequest(
    string Type,
    string Title,
    string Content,
    string? RelatedMatchId
);

public record AddFeedbackMessageRequest(
    string Content
);

public record AdminReplyFeedbackRequest(
    string Content,
    string Reason
);

public record AdminChangeStatusRequest(
    string Status,
    string Reason
);

public record AdminAssignFeedbackRequest(
    string? AdminId,
    string Reason
);

public record FeedbackMessageDto(
    Guid Id,
    Guid TicketId,
    string SenderId,
    string SenderRole,
    string Content,
    DateTime CreatedAt
);

public record FeedbackTicketDto(
    Guid Id,
    string UserId,
    string Type,
    string Title,
    string Status,
    string? AssignedAdminId,
    string? RelatedMatchId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<FeedbackMessageDto>? Messages
);

public record NotificationDto(
    Guid Id,
    string UserId,
    string Type,
    string Title,
    string Body,
    string? RefId,
    bool IsRead,
    DateTime CreatedAt
);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
