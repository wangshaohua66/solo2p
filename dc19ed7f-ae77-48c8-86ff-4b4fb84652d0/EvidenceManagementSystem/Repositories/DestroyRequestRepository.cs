using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class DestroyRequestRepository : Repository<DestroyRequest>, IDestroyRequestRepository
{
    public DestroyRequestRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<PagedResult<DestroyRequest>> SearchAsync(DestroyQuery query)
    {
        var q = _dbSet.AsQueryable();

        if (query.IsApproved.HasValue)
            q = q.Where(d => d.IsApproved == query.IsApproved.Value);
        if (query.IsExecuted.HasValue)
            q = q.Where(d => d.IsExecuted == query.IsExecuted.Value);
        if (query.RequestedById.HasValue)
            q = q.Where(d => d.RequestedById == query.RequestedById.Value);
        if (query.ApprovedById.HasValue)
            q = q.Where(d => d.ApprovedById == query.ApprovedById.Value);
        if (query.StartDate.HasValue)
            q = q.Where(d => d.RequestedAt >= query.StartDate.Value);
        if (query.EndDate.HasValue)
            q = q.Where(d => d.RequestedAt <= query.EndDate.Value);

        var totalCount = await q.CountAsync();

        var items = await q
            .Include(d => d.Evidence)
            .OrderByDescending(d => d.RequestedAt)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<DestroyRequest>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize
        };
    }

    public async Task<DestroyRequest?> GetByRequestNumberAsync(string requestNumber)
    {
        return await _dbSet
            .Include(d => d.Evidence)
            .FirstOrDefaultAsync(d => d.RequestNumber == requestNumber);
    }

    public async Task<List<DestroyRequest>> GetByEvidenceIdAsync(Guid evidenceId)
    {
        return await _dbSet
            .Where(d => d.EvidenceId == evidenceId)
            .OrderByDescending(d => d.RequestedAt)
            .ToListAsync();
    }
}
