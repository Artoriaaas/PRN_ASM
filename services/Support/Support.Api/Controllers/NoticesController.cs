namespace Support.Api.Controllers;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Support.Api.Contracts;
using Support.Api.Domain.Services;

[ApiController]
[Route("api/v1/notices")]
public sealed class NoticesController(INoticeService service) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<PagedResponse<SystemNoticeDto>>> GetPaged([FromQuery] NoticeQueryParams query, CancellationToken ct)
    {
        var response = await service.GetPagedAsync(query, ct);
        return Ok(response);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<SystemNoticeDto>> GetById(Guid id, CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return Ok(item);
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<SystemNoticeDto>> Create([FromBody] CreateNoticeRequest request, CancellationToken ct)
    {
        var created = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<SystemNoticeDto>> Update(Guid id, [FromBody] UpdateNoticeRequest request, CancellationToken ct)
    {
        var updated = await service.UpdateAsync(id, request, ct);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}
