namespace Support.Api.Domain.Services;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Support.Api.Contracts;
using Support.Api.Data;
using Support.Api.Domain.Entities;

public sealed class FeedbackService(
    SupportDbContext dbContext,
    ISupportUnitOfWork unitOfWork) : IFeedbackService
{
    private static readonly HashSet<string> AllowedTypes = ["BUG", "SUGGESTION", "REPORT_PLAYER", "OTHER"];
    private static readonly HashSet<string> AllowedStatuses = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];

    public async Task<FeedbackTicketDto> SubmitFeedbackAsync(
        string userFirebaseUid,
        SubmitFeedbackRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(userFirebaseUid))
            throw new ArgumentException("Người dùng chưa đăng nhập.");

        string type = request.Type?.Trim().ToUpperInvariant() ?? "OTHER";
        if (!AllowedTypes.Contains(type))
            throw new ArgumentException($"Loại feedback không hợp lệ: {request.Type}");

        string title = request.Title?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(title) || title.Length > 200)
            throw new ArgumentException("Tiêu đề không được để trống và tối đa 200 ký tự.");

        string content = request.Content?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(content) || content.Length > 5000)
            throw new ArgumentException("Nội dung không được để trống và tối đa 5000 ký tự.");

        var now = DateTime.UtcNow;
        var ticket = new FeedbackTicket
        {
            Id = Guid.NewGuid(),
            UserId = userFirebaseUid,
            Type = type,
            Title = title,
            Status = "NEW",
            RelatedMatchId = request.RelatedMatchId?.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        var firstMessage = new FeedbackMessage
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            SenderId = userFirebaseUid,
            SenderRole = "USER",
            Content = content,
            CreatedAt = now
        };

        ticket.Messages.Add(firstMessage);

        await dbContext.FeedbackTickets.AddAsync(ticket, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MapTicket(ticket, [firstMessage]);
    }

    public async Task<PagedResult<FeedbackTicketDto>> GetUserTicketsAsync(
        string userFirebaseUid,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        int safePage = Math.Max(1, page);
        int safePageSize = Math.Clamp(pageSize, 1, 50);

        var query = dbContext.FeedbackTickets
            .AsNoTracking()
            .Where(t => t.UserId == userFirebaseUid);

        int total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(t => new FeedbackTicketDto(
                t.Id,
                t.UserId,
                t.Type,
                t.Title,
                t.Status,
                t.AssignedAdminId,
                t.RelatedMatchId,
                t.CreatedAt,
                t.UpdatedAt,
                null,
                null))
            .ToListAsync(cancellationToken);

        return new PagedResult<FeedbackTicketDto>(items, total, safePage, safePageSize);
    }

    public async Task<FeedbackTicketDto> GetTicketDetailAsync(
        string userFirebaseUid,
        Guid ticketId,
        CancellationToken cancellationToken)
    {
        var ticket = await dbContext.FeedbackTickets
            .AsNoTracking()
            .Include(t => t.Messages)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        if (ticket == null || ticket.UserId != userFirebaseUid)
            throw new KeyNotFoundException("Không tìm thấy ticket phản hồi.");

        return MapTicket(ticket, ticket.Messages.OrderBy(m => m.CreatedAt).ToList());
    }

    public async Task<FeedbackMessageDto> AddUserMessageAsync(
        string userFirebaseUid,
        Guid ticketId,
        string content,
        CancellationToken cancellationToken)
    {
        var ticket = await dbContext.FeedbackTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy ticket phản hồi.");

        if (ticket.UserId != userFirebaseUid)
            throw new UnauthorizedAccessException("Bạn không có quyền gửi tin nhắn trong ticket này.");

        if (ticket.Status == "CLOSED")
            throw new InvalidOperationException("Không thể gửi tin nhắn vào ticket đã đóng (CLOSED).");

        string cleanContent = content?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanContent) || cleanContent.Length > 5000)
            throw new ArgumentException("Nội dung tin nhắn không hợp lệ (tối đa 5000 ký tự).");

        var now = DateTime.UtcNow;
        var msg = new FeedbackMessage
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            SenderId = userFirebaseUid,
            SenderRole = "USER",
            Content = cleanContent,
            CreatedAt = now
        };

        ticket.UpdatedAt = now;
        await dbContext.FeedbackMessages.AddAsync(msg, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new FeedbackMessageDto(msg.Id, msg.TicketId, msg.SenderId, msg.SenderRole, msg.Content, msg.CreatedAt);
    }

    public async Task<PagedResult<FeedbackTicketDto>> AdminGetQueueAsync(
        int page,
        int pageSize,
        string? status,
        string? type,
        string? search,
        CancellationToken cancellationToken)
    {
        int safePage = Math.Max(1, page);
        int safePageSize = Math.Clamp(pageSize, 1, 100);

        var query = dbContext.FeedbackTickets.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
        {
            string s = status.Trim().ToUpperInvariant();
            query = query.Where(t => t.Status == s);
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            string tp = type.Trim().ToUpperInvariant();
            query = query.Where(t => t.Type == tp);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            string term = search.Trim().ToLower();
            query = query.Where(t => t.Title.ToLower().Contains(term) || t.UserId.ToLower().Contains(term));
        }

        int total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(t => new FeedbackTicketDto(
                t.Id,
                t.UserId,
                t.Type,
                t.Title,
                t.Status,
                t.AssignedAdminId,
                t.RelatedMatchId,
                t.CreatedAt,
                t.UpdatedAt,
                null,
                null))
            .ToListAsync(cancellationToken);

        return new PagedResult<FeedbackTicketDto>(items, total, safePage, safePageSize);
    }

    public async Task<FeedbackTicketDto> AdminGetTicketDetailAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var ticket = await dbContext.FeedbackTickets
            .AsNoTracking()
            .Include(t => t.Messages)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy ticket phản hồi.");

        var statusHistory = await GetStatusHistoryAsync(ticketId, cancellationToken);
        return MapTicket(ticket, ticket.Messages.OrderBy(m => m.CreatedAt).ToList(), statusHistory);
    }

    public async Task<FeedbackMessageDto> AdminReplyAsync(
        string adminFirebaseUid,
        Guid ticketId,
        string content,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var ticket = await dbContext.FeedbackTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy ticket phản hồi.");

        if (ticket.Status == "CLOSED")
            throw new InvalidOperationException("Không thể phản hồi ticket đã đóng (CLOSED).");

        string cleanContent = content?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanContent) || cleanContent.Length > 5000)
            throw new ArgumentException("Nội dung phản hồi không hợp lệ.");

        var now = DateTime.UtcNow;
        var msg = new FeedbackMessage
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            SenderId = adminFirebaseUid,
            SenderRole = "ADMIN",
            Content = cleanContent,
            CreatedAt = now
        };

        if (ticket.Status == "NEW")
        {
            ticket.Status = "IN_PROGRESS";
        }
        ticket.UpdatedAt = now;

        await dbContext.FeedbackMessages.AddAsync(msg, cancellationToken);

        // Same transaction: create notification for ticket owner
        await dbContext.Notifications.AddAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = ticket.UserId,
            Type = "FEEDBACK_REPLIED",
            Title = "Phản hồi mới về ticket: " + ticket.Title,
            Body = cleanContent.Length > 120 ? cleanContent[..120] + "..." : cleanContent,
            RefId = ticket.Id.ToString(),
            SourceEventId = msg.Id.ToString(),
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);

        // Audit log
        await dbContext.SupportAuditLogs.AddAsync(new SupportAuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = adminFirebaseUid,
            Action = "REPLY_FEEDBACK",
            TargetType = "FEEDBACK_TICKET",
            TargetId = ticket.Id.ToString(),
            Before = JsonSerializer.Serialize(new { ticket.Status }),
            After = JsonSerializer.Serialize(new { MessageId = msg.Id, ticket.Status }),
            Reason = reason,
            CreatedAt = now
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new FeedbackMessageDto(msg.Id, msg.TicketId, msg.SenderId, msg.SenderRole, msg.Content, msg.CreatedAt);
    }

    public async Task<FeedbackTicketDto> AdminChangeStatusAsync(
        string adminFirebaseUid,
        Guid ticketId,
        string status,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        string newStatus = status?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!AllowedStatuses.Contains(newStatus))
            throw new ArgumentException($"Trạng thái không hợp lệ: {status}");

        var ticket = await dbContext.FeedbackTickets
            .Include(t => t.Messages)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy ticket phản hồi.");

        if (ticket.Status == "CLOSED" && newStatus != "CLOSED")
            throw new InvalidOperationException("Ticket đã đóng (CLOSED) không thể thay đổi trạng thái.");

        string oldStatus = ticket.Status;
        if (oldStatus == newStatus)
        {
            var unchangedHistory = await GetStatusHistoryAsync(ticketId, cancellationToken);
            return MapTicket(ticket, ticket.Messages, unchangedHistory);
        }

        var now = DateTime.UtcNow;
        ticket.Status = newStatus;
        ticket.UpdatedAt = now;

        string changeEventId = Guid.NewGuid().ToString();

        // Same transaction: Notification
        await dbContext.Notifications.AddAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = ticket.UserId,
            Type = "FEEDBACK_STATUS_CHANGED",
            Title = "Trạng thái ticket đã cập nhật: " + ticket.Title,
            Body = $"Ticket đã chuyển sang trạng thái [{newStatus}]. Lý do: {reason}",
            RefId = ticket.Id.ToString(),
            SourceEventId = changeEventId,
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);

        // Audit log
        await dbContext.SupportAuditLogs.AddAsync(new SupportAuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = adminFirebaseUid,
            Action = "CHANGE_FEEDBACK_STATUS",
            TargetType = "FEEDBACK_TICKET",
            TargetId = ticket.Id.ToString(),
            Before = JsonSerializer.Serialize(new { Status = oldStatus }),
            After = JsonSerializer.Serialize(new { Status = newStatus }),
            Reason = reason,
            CreatedAt = now
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        var statusHistory = await GetStatusHistoryAsync(ticketId, cancellationToken);
        return MapTicket(ticket, ticket.Messages, statusHistory);
    }

    public async Task<FeedbackTicketDto> AdminAssignAsync(
        string adminFirebaseUid,
        Guid ticketId,
        string? targetAdminId,
        string reason,
        CancellationToken cancellationToken)
    {
        ValidateReason(reason);

        var ticket = await dbContext.FeedbackTickets
            .Include(t => t.Messages)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy ticket phản hồi.");

        string? oldAssignee = ticket.AssignedAdminId;
        var now = DateTime.UtcNow;
        ticket.AssignedAdminId = targetAdminId?.Trim();
        ticket.UpdatedAt = now;

        await dbContext.SupportAuditLogs.AddAsync(new SupportAuditLog
        {
            Id = Guid.NewGuid(),
            ActorId = adminFirebaseUid,
            Action = "ASSIGN_FEEDBACK",
            TargetType = "FEEDBACK_TICKET",
            TargetId = ticket.Id.ToString(),
            Before = JsonSerializer.Serialize(new { AssignedAdminId = oldAssignee }),
            After = JsonSerializer.Serialize(new { AssignedAdminId = ticket.AssignedAdminId }),
            Reason = reason,
            CreatedAt = now
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MapTicket(ticket, ticket.Messages);
    }

    public async Task<PagedResult<NotificationDto>> GetUserNotificationsAsync(
        string userFirebaseUid,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        int safePage = Math.Max(1, page);
        int safePageSize = Math.Clamp(pageSize, 1, 50);

        var query = dbContext.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userFirebaseUid);

        int total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(n => new NotificationDto(
                n.Id,
                n.UserId,
                n.Type,
                n.Title,
                n.Body,
                n.RefId,
                n.IsRead,
                n.CreatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResult<NotificationDto>(items, total, safePage, safePageSize);
    }

    public async Task<bool> MarkNotificationReadAsync(
        string userFirebaseUid,
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        var notif = await dbContext.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userFirebaseUid, cancellationToken);

        if (notif == null) return false;

        notif.IsRead = true;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkAllNotificationsReadAsync(
        string userFirebaseUid,
        CancellationToken cancellationToken)
    {
        var unread = await dbContext.Notifications
            .Where(n => n.UserId == userFirebaseUid && !n.IsRead)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0) return true;

        foreach (var n in unread)
        {
            n.IsRead = true;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static void ValidateReason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Lý do thao tác (reason) là bắt buộc đối với mọi hành động quản trị.");
    }

    private async Task<List<FeedbackStatusHistoryDto>> GetStatusHistoryAsync(
        Guid ticketId,
        CancellationToken cancellationToken)
    {
        string targetId = ticketId.ToString();
        var rows = await dbContext.SupportAuditLogs
            .AsNoTracking()
            .Where(log =>
                log.Action == "CHANGE_FEEDBACK_STATUS" &&
                log.TargetType == "FEEDBACK_TICKET" &&
                log.TargetId == targetId)
            .OrderByDescending(log => log.CreatedAt)
            .Take(50)
            .Select(log => new
            {
                log.Before,
                log.After,
                log.Reason,
                log.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(row => new FeedbackStatusHistoryDto(
                ReadStatusFromAuditJson(row.Before),
                ReadStatusFromAuditJson(row.After),
                row.Reason,
                row.CreatedAt))
            .ToList();
    }

    private static string ReadStatusFromAuditJson(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.TryGetProperty("Status", out var status)
                ? status.GetString() ?? string.Empty
                : string.Empty;
        }
        catch (JsonException)
        {
            return string.Empty;
        }
    }

    private static FeedbackTicketDto MapTicket(
        FeedbackTicket t,
        IEnumerable<FeedbackMessage>? messages,
        List<FeedbackStatusHistoryDto>? statusHistory = null)
    {
        var msgDtos = messages?
            .Select(m => new FeedbackMessageDto(m.Id, m.TicketId, m.SenderId, m.SenderRole, m.Content, m.CreatedAt))
            .ToList();

        return new FeedbackTicketDto(
            t.Id,
            t.UserId,
            t.Type,
            t.Title,
            t.Status,
            t.AssignedAdminId,
            t.RelatedMatchId,
            t.CreatedAt,
            t.UpdatedAt,
            msgDtos,
            statusHistory);
    }
}
