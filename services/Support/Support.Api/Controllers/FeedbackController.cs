namespace Support.Api.Controllers;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Support.Api.Contracts;
using Support.Api.Domain.Services;

[ApiController]
[Route("api/v1/feedback")]
[Authorize]
public sealed class FeedbackController(IFeedbackService feedbackService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> SubmitFeedback([FromBody] SubmitFeedbackRequest request, CancellationToken ct)
    {
        string? uid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();

        var ticket = await feedbackService.SubmitFeedbackAsync(uid, request, ct);
        return Ok(ticket);
    }

    [HttpGet]
    public async Task<IActionResult> GetUserTickets([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        string? uid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();

        var result = await feedbackService.GetUserTicketsAsync(uid, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetTicketDetail(Guid id, CancellationToken ct)
    {
        string? uid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();

        var detail = await feedbackService.GetTicketDetailAsync(uid, id, ct);
        return Ok(detail);
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] AddFeedbackMessageRequest request, CancellationToken ct)
    {
        string? uid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(uid)) return Unauthorized();

        var msg = await feedbackService.AddUserMessageAsync(uid, id, request.Content, ct);
        return Ok(msg);
    }
}
