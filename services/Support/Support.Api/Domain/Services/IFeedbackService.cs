namespace Support.Api.Domain.Services;

using System;
using System.Threading;
using System.Threading.Tasks;
using Support.Api.Contracts;

public interface IFeedbackService
{
    // User endpoints
    Task<FeedbackTicketDto> SubmitFeedbackAsync(string userFirebaseUid, SubmitFeedbackRequest request, CancellationToken cancellationToken);
    Task<PagedResult<FeedbackTicketDto>> GetUserTicketsAsync(string userFirebaseUid, int page, int pageSize, CancellationToken cancellationToken);
    Task<FeedbackTicketDto> GetTicketDetailAsync(string userFirebaseUid, Guid ticketId, CancellationToken cancellationToken);
    Task<FeedbackMessageDto> AddUserMessageAsync(string userFirebaseUid, Guid ticketId, string content, CancellationToken cancellationToken);

    // Admin endpoints
    Task<PagedResult<FeedbackTicketDto>> AdminGetQueueAsync(int page, int pageSize, string? status, string? type, string? search, CancellationToken cancellationToken);
    Task<FeedbackTicketDto> AdminGetTicketDetailAsync(Guid ticketId, CancellationToken cancellationToken);
    Task<FeedbackMessageDto> AdminReplyAsync(string adminFirebaseUid, Guid ticketId, string content, string reason, CancellationToken cancellationToken);
    Task<FeedbackTicketDto> AdminChangeStatusAsync(string adminFirebaseUid, Guid ticketId, string status, string reason, CancellationToken cancellationToken);
    Task<FeedbackTicketDto> AdminAssignAsync(string adminFirebaseUid, Guid ticketId, string? targetAdminId, string reason, CancellationToken cancellationToken);

    // Notifications
    Task<PagedResult<NotificationDto>> GetUserNotificationsAsync(string userFirebaseUid, int page, int pageSize, CancellationToken cancellationToken);
    Task<bool> MarkNotificationReadAsync(string userFirebaseUid, Guid notificationId, CancellationToken cancellationToken);
    Task<bool> MarkAllNotificationsReadAsync(string userFirebaseUid, CancellationToken cancellationToken);
}
