using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class OverdueApprovalRepository : Repository<OverdueApproval>, IOverdueApprovalRepository
{
    public OverdueApprovalRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<PagedResult<OverdueApproval>> SearchAsync(OverdueApprovalQuery query)
    {
        var q = _dbSet.AsQueryable();

        if (query.Status.HasValue)
            q = q.Where(a => a.Status == query.Status.Value);
        if (query.SubmittedById.HasValue)
            q = q.Where(a => a.SubmittedById == query.SubmittedById.Value);
        if (query.ApprovedById.HasValue)
            q = q.Where(a => a.ApprovedById == query.ApprovedById.Value);
        if (query.StartDate.HasValue)
            q = q.Where(a => a.SubmittedAt >= query.StartDate.Value);
        if (query.EndDate.HasValue)
            q = q.Where(a => a.SubmittedAt <= query.EndDate.Value);

        var totalCount = await q.CountAsync();

        var items = await q
            .OrderByDescending(a => a.SubmittedAt)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<OverdueApproval>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize
        };
    }

    public async Task<OverdueApproval?> GetByWarningIdAsync(Guid warningId)
    {
        return await _dbSet
            .FirstOrDefaultAsync(a => a.WarningId == warningId);
    }
}
