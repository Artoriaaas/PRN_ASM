namespace Support.Api.Controllers;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Support.Api.Contracts;
using Support.Api.Domain.Services;

[ApiController]
[Route("api/v1/admin/feedback")]
[Authorize(Policy = "Admin")]
public sealed class AdminFeedbackController(IFeedbackService feedbackService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetQueue(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var result = await feedbackService.AdminGetQueueAsync(page, pageSize, status, type, search, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetTicketDetail(Guid id, CancellationToken ct)
    {
        try
        {
            var detail = await feedbackService.AdminGetTicketDetailAsync(id, ct);
            return Ok(detail);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Không tìm thấy ticket." });
        }
    }

    [HttpPost("{id:guid}/reply")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] AdminReplyFeedbackRequest request, CancellationToken ct)
    {
        string? adminUid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(adminUid)) return Unauthorized();

        try
        {
            var msg = await feedbackService.AdminReplyAsync(adminUid, id, request.Content, request.Reason, ct);
            return Ok(msg);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Không tìm thấy ticket." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] AdminChangeStatusRequest request, CancellationToken ct)
    {
        string? adminUid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(adminUid)) return Unauthorized();

        try
        {
            var ticket = await feedbackService.AdminChangeStatusAsync(adminUid, id, request.Status, request.Reason, ct);
            return Ok(ticket);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Không tìm thấy ticket." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/assign")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AdminAssignFeedbackRequest request, CancellationToken ct)
    {
        string? adminUid = User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(adminUid)) return Unauthorized();

        try
        {
            var ticket = await feedbackService.AdminAssignAsync(adminUid, id, request.AdminId, request.Reason, ct);
            return Ok(ticket);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Không tìm thấy ticket." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
