namespace Support.Api.Data.Repositories;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Support.Api.Contracts;
using Support.Api.Domain.Entities;
using Support.Api.Domain.Repositories;

public sealed class TutorialRepository(SupportDbContext db) : ITutorialRepository
{
    public async Task<(IReadOnlyList<TutorialDto> Items, int TotalCount)> SearchPagedAsync(
        TutorialQueryParams query,
        CancellationToken ct)
    {
        int page = Math.Max(1, query.Page);
        int pageSize = Math.Clamp(query.PageSize, 1, 50);

        IQueryable<Tutorial> q = db.Tutorials.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string keyword = query.Search.Trim().ToLower();
            q = q.Where(t => t.Title.ToLower().Contains(keyword) || t.Summary.ToLower().Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            q = q.Where(t => t.Category == query.Category);
        }

        if (!string.IsNullOrWhiteSpace(query.Difficulty))
        {
            q = q.Where(t => t.Difficulty == query.Difficulty);
        }

        if (query.IsPublished.HasValue)
        {
            q = q.Where(t => t.IsPublished == query.IsPublished.Value);
        }

        int totalCount = await q.CountAsync(ct);

        bool desc = string.Equals(query.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        q = (query.SortBy?.ToLowerInvariant()) switch
        {
            "title"     => desc ? q.OrderByDescending(t => t.Title)     : q.OrderBy(t => t.Title),
            "createdat" => desc ? q.OrderByDescending(t => t.CreatedAt) : q.OrderBy(t => t.CreatedAt),
            "difficulty"=> desc ? q.OrderByDescending(t => t.Difficulty): q.OrderBy(t => t.Difficulty),
            _           => desc ? q.OrderByDescending(t => t.SortOrder) : q.OrderBy(t => t.SortOrder)
        };

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TutorialDto(
                t.Id, t.Title, t.Summary, t.Content, t.Category,
                t.Difficulty, t.SortOrder, t.IsPublished, t.CreatedAt, t.UpdatedAt))
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<Tutorial?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return db.Tutorials.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public Task<Tutorial?> GetByIdForUpdateAsync(Guid id, CancellationToken ct)
    {
        return db.Tutorials.FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public Task AddAsync(Tutorial tutorial, CancellationToken ct)
    {
        return db.Tutorials.AddAsync(tutorial, ct).AsTask();
    }

    public void Remove(Tutorial tutorial)
    {
        db.Tutorials.Remove(tutorial);
    }
}

public sealed class NoticeRepository(SupportDbContext db) : INoticeRepository
{
    public async Task<(IReadOnlyList<SystemNoticeDto> Items, int TotalCount)> SearchPagedAsync(
        NoticeQueryParams query,
        CancellationToken ct)
    {
        int page = Math.Max(1, query.Page);
        int pageSize = Math.Clamp(query.PageSize, 1, 50);

        IQueryable<SystemNotice> q = db.SystemNotices.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string keyword = query.Search.Trim().ToLower();
            q = q.Where(n => n.Title.ToLower().Contains(keyword) || n.Content.ToLower().Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            q = q.Where(n => n.Category == query.Category);
        }

        if (query.IsPinned.HasValue)
        {
            q = q.Where(n => n.IsPinned == query.IsPinned.Value);
        }

        int totalCount = await q.CountAsync(ct);

        bool desc = string.Equals(query.SortDir, "desc", StringComparison.OrdinalIgnoreCase);
        q = (query.SortBy?.ToLowerInvariant()) switch
        {
            "title"       => desc ? q.OrderByDescending(n => n.Title)       : q.OrderBy(n => n.Title),
            "createdat"   => desc ? q.OrderByDescending(n => n.CreatedAt)   : q.OrderBy(n => n.CreatedAt),
            _             => desc ? q.OrderByDescending(n => n.PublishedAt) : q.OrderBy(n => n.PublishedAt)
        };

        var items = await q
            .OrderByDescending(n => n.IsPinned) // Luôn ưu tiên pinned lên đầu
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new SystemNoticeDto(
                n.Id, n.Title, n.Content, n.Category, n.IsPinned, n.PublishedAt, n.CreatedAt))
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<SystemNotice?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return db.SystemNotices.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id, ct);
    }

    public Task<SystemNotice?> GetByIdForUpdateAsync(Guid id, CancellationToken ct)
    {
        return db.SystemNotices.FirstOrDefaultAsync(n => n.Id == id, ct);
    }

    public Task AddAsync(SystemNotice notice, CancellationToken ct)
    {
        return db.SystemNotices.AddAsync(notice, ct).AsTask();
    }

    public void Remove(SystemNotice notice)
    {
        db.SystemNotices.Remove(notice);
    }
}
