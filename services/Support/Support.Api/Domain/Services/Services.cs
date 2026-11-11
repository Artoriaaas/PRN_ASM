namespace Support.Api.Domain.Services;

using System;
using System.Threading;
using System.Threading.Tasks;
using Support.Api.Contracts;
using Support.Api.Domain.Entities;
using Support.Api.Domain.Exceptions;
using Support.Api.Domain.Repositories;

public sealed class TutorialService(ITutorialRepository repository, ISupportUnitOfWork uow) : ITutorialService
{
    public async Task<PagedResponse<TutorialDto>> GetPagedAsync(TutorialQueryParams query, CancellationToken ct)
    {
        var (items, totalCount) = await repository.SearchPagedAsync(query, ct);
        int pageSize = Math.Clamp(query.PageSize, 1, 50);
        int totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedResponse<TutorialDto>(items, Math.Max(1, query.Page), pageSize, totalCount, totalPages);
    }

    public async Task<TutorialDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.GetByIdAsync(id, ct)
            ?? throw new NotFoundException($"Không tìm thấy bài hướng dẫn với Id: {id}");

        return new TutorialDto(
            entity.Id, entity.Title, entity.Summary, entity.Content, entity.Category,
            entity.Difficulty, entity.SortOrder, entity.IsPublished, entity.CreatedAt, entity.UpdatedAt);
    }

    public async Task<TutorialDto> CreateAsync(CreateTutorialRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ValidationException("Tiêu đề hướng dẫn không được để trống.");
        }

        var entity = new Tutorial
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Summary = request.Summary?.Trim() ?? string.Empty,
            Content = request.Content?.Trim() ?? string.Empty,
            Category = string.IsNullOrWhiteSpace(request.Category) ? "General" : request.Category.Trim(),
            Difficulty = string.IsNullOrWhiteSpace(request.Difficulty) ? "Easy" : request.Difficulty.Trim(),
            SortOrder = request.SortOrder,
            IsPublished = request.IsPublished,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await repository.AddAsync(entity, ct);
        await uow.SaveChangesAsync(ct);

        return new TutorialDto(
            entity.Id, entity.Title, entity.Summary, entity.Content, entity.Category,
            entity.Difficulty, entity.SortOrder, entity.IsPublished, entity.CreatedAt, entity.UpdatedAt);
    }

    public async Task<TutorialDto> UpdateAsync(Guid id, UpdateTutorialRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ValidationException("Tiêu đề hướng dẫn không được để trống.");
        }

        var entity = await repository.GetByIdForUpdateAsync(id, ct)
            ?? throw new NotFoundException($"Không tìm thấy bài hướng dẫn với Id: {id}");

        entity.Title = request.Title.Trim();
        entity.Summary = request.Summary?.Trim() ?? string.Empty;
        entity.Content = request.Content?.Trim() ?? string.Empty;
        entity.Category = string.IsNullOrWhiteSpace(request.Category) ? entity.Category : request.Category.Trim();
        entity.Difficulty = string.IsNullOrWhiteSpace(request.Difficulty) ? entity.Difficulty : request.Difficulty.Trim();
        entity.SortOrder = request.SortOrder;
        entity.IsPublished = request.IsPublished;
        entity.UpdatedAt = DateTime.UtcNow;

        await uow.SaveChangesAsync(ct);

        return new TutorialDto(
            entity.Id, entity.Title, entity.Summary, entity.Content, entity.Category,
            entity.Difficulty, entity.SortOrder, entity.IsPublished, entity.CreatedAt, entity.UpdatedAt);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.GetByIdForUpdateAsync(id, ct)
            ?? throw new NotFoundException($"Không tìm thấy bài hướng dẫn với Id: {id}");

        repository.Remove(entity);
        await uow.SaveChangesAsync(ct);
    }
}

public sealed class NoticeService(INoticeRepository repository, ISupportUnitOfWork uow) : INoticeService
{
    public async Task<PagedResponse<SystemNoticeDto>> GetPagedAsync(NoticeQueryParams query, CancellationToken ct)
    {
        var (items, totalCount) = await repository.SearchPagedAsync(query, ct);
        int pageSize = Math.Clamp(query.PageSize, 1, 50);
        int totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedResponse<SystemNoticeDto>(items, Math.Max(1, query.Page), pageSize, totalCount, totalPages);
    }

    public async Task<SystemNoticeDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.GetByIdAsync(id, ct)
            ?? throw new NotFoundException($"Không tìm thấy thông báo với Id: {id}");

        return new SystemNoticeDto(
            entity.Id, entity.Title, entity.Content, entity.Category, entity.IsPinned, entity.PublishedAt, entity.CreatedAt);
    }

    public async Task<SystemNoticeDto> CreateAsync(CreateNoticeRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ValidationException("Tiêu đề thông báo không được để trống.");
        }

        var entity = new SystemNotice
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Content = request.Content?.Trim() ?? string.Empty,
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Notice" : request.Category.Trim(),
            IsPinned = request.IsPinned,
            PublishedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        await repository.AddAsync(entity, ct);
        await uow.SaveChangesAsync(ct);

        return new SystemNoticeDto(
            entity.Id, entity.Title, entity.Content, entity.Category, entity.IsPinned, entity.PublishedAt, entity.CreatedAt);
    }

    public async Task<SystemNoticeDto> UpdateAsync(Guid id, UpdateNoticeRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ValidationException("Tiêu đề thông báo không được để trống.");
        }

        var entity = await repository.GetByIdForUpdateAsync(id, ct)
            ?? throw new NotFoundException($"Không tìm thấy thông báo với Id: {id}");

        entity.Title = request.Title.Trim();
        entity.Content = request.Content?.Trim() ?? string.Empty;
        entity.Category = string.IsNullOrWhiteSpace(request.Category) ? entity.Category : request.Category.Trim();
        entity.IsPinned = request.IsPinned;

        await uow.SaveChangesAsync(ct);

        return new SystemNoticeDto(
            entity.Id, entity.Title, entity.Content, entity.Category, entity.IsPinned, entity.PublishedAt, entity.CreatedAt);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.GetByIdForUpdateAsync(id, ct)
            ?? throw new NotFoundException($"Không tìm thấy thông báo với Id: {id}");

        repository.Remove(entity);
        await uow.SaveChangesAsync(ct);
    }
}
