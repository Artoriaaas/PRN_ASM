namespace Support.Api.Controllers;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Support.Api.Domain.Services;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public sealed class NotificationsController(IFeedbackService feedbackService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        string? uid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();

        var result = await feedbackService.GetUserNotificationsAsync(uid, page, pageSize, ct);
        return Ok(result);
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        string? uid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();

        bool success = await feedbackService.MarkNotificationReadAsync(uid, id, ct);
        return Ok(new { success });
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        string? uid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();

        bool success = await feedbackService.MarkAllNotificationsReadAsync(uid, ct);
        return Ok(new { success });
    }
}
