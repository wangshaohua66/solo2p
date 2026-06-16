using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class OverdueWarningRepository : Repository<OverdueWarning>, IOverdueWarningRepository
{
    public OverdueWarningRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<PagedResult<OverdueWarning>> SearchAsync(OverdueWarningQuery query)
    {
        var q = _dbSet.AsQueryable();

        if (query.IsWarning.HasValue)
            q = q.Where(o => o.IsWarning == query.IsWarning.Value);
        if (query.IsOverdue.HasValue)
            q = q.Where(o => o.IsOverdue == query.IsOverdue.Value);
        if (query.Category.HasValue)
            q = q.Where(o => o.Category == query.Category.Value);
        if (query.Notified.HasValue)
            q = q.Where(o => o.Notified == query.Notified.Value);
        if (query.Resolved.HasValue)
            q = q.Where(o => o.Resolved == query.Resolved.Value);

        var totalCount = await q.CountAsync();

        var items = await q
            .OrderBy(o => o.ExpectedExpiryDate)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<OverdueWarning>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize
        };
    }

    public async Task<List<OverdueWarning>> GetUnresolvedWarningsAsync()
    {
        return await _dbSet
            .Where(o => !o.Resolved)
            .OrderBy(o => o.ExpectedExpiryDate)
            .ToListAsync();
    }

    public async Task<List<OverdueWarning>> GetUnnotifiedWarningsAsync()
    {
        return await _dbSet
            .Where(o => !o.Notified && !o.Resolved)
            .OrderBy(o => o.GeneratedAt)
            .ToListAsync();
    }

    public async Task MarkAsNotifiedAsync(Guid id)
    {
        var warning = await _dbSet.FindAsync(id);
        if (warning != null)
        {
            warning.Notified = true;
            warning.NotifiedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task ResolveWarningAsync(Guid id, string remark)
    {
        var warning = await _dbSet.FindAsync(id);
        if (warning != null)
        {
            warning.Resolved = true;
            warning.ResolvedAt = DateTime.UtcNow;
            warning.ResolveRemark = remark;
            await _context.SaveChangesAsync();
        }
    }
}
