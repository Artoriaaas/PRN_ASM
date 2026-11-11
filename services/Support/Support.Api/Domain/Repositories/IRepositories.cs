namespace Support.Api.Domain.Repositories;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Support.Api.Contracts;
using Support.Api.Domain.Entities;

public interface ITutorialRepository
{
    Task<(IReadOnlyList<TutorialDto> Items, int TotalCount)> SearchPagedAsync(TutorialQueryParams query, CancellationToken ct);
    Task<Tutorial?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<Tutorial?> GetByIdForUpdateAsync(Guid id, CancellationToken ct);
    Task AddAsync(Tutorial tutorial, CancellationToken ct);
    void Remove(Tutorial tutorial);
}

public interface INoticeRepository
{
    Task<(IReadOnlyList<SystemNoticeDto> Items, int TotalCount)> SearchPagedAsync(NoticeQueryParams query, CancellationToken ct);
    Task<SystemNotice?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<SystemNotice?> GetByIdForUpdateAsync(Guid id, CancellationToken ct);
    Task AddAsync(SystemNotice notice, CancellationToken ct);
    void Remove(SystemNotice notice);
}
