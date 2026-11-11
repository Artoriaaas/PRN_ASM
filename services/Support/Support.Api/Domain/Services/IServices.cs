namespace Support.Api.Domain.Services;

using System;
using System.Threading;
using System.Threading.Tasks;
using Support.Api.Contracts;

public interface ITutorialService
{
    Task<PagedResponse<TutorialDto>> GetPagedAsync(TutorialQueryParams query, CancellationToken ct);
    Task<TutorialDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<TutorialDto> CreateAsync(CreateTutorialRequest request, CancellationToken ct);
    Task<TutorialDto> UpdateAsync(Guid id, UpdateTutorialRequest request, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public interface INoticeService
{
    Task<PagedResponse<SystemNoticeDto>> GetPagedAsync(NoticeQueryParams query, CancellationToken ct);
    Task<SystemNoticeDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SystemNoticeDto> CreateAsync(CreateNoticeRequest request, CancellationToken ct);
    Task<SystemNoticeDto> UpdateAsync(Guid id, UpdateNoticeRequest request, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}
