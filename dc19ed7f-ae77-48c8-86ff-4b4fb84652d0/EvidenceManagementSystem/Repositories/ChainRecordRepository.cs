using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class ChainRecordRepository : Repository<ChainRecord>, IChainRecordRepository
{
    public ChainRecordRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<List<ChainRecord>> GetByEvidenceIdAsync(Guid evidenceId)
    {
        return await _dbSet
            .Where(c => c.EvidenceId == evidenceId)
            .OrderBy(c => c.SequenceNumber)
            .ToListAsync();
    }

    public async Task<PagedResult<ChainRecord>> SearchAsync(ChainQuery query)
    {
        var q = _dbSet.AsQueryable();

        if (query.EvidenceId.HasValue)
            q = q.Where(c => c.EvidenceId == query.EvidenceId.Value);
        if (query.OperationType.HasValue)
            q = q.Where(c => c.OperationType == query.OperationType.Value);
        if (query.OperatorId.HasValue)
            q = q.Where(c => c.OperatorId == query.OperatorId.Value);
        if (query.StartDate.HasValue)
            q = q.Where(c => c.OperationTime >= query.StartDate.Value);
        if (query.EndDate.HasValue)
            q = q.Where(c => c.OperationTime <= query.EndDate.Value);

        var totalCount = await q.CountAsync();

        var items = await q
            .OrderByDescending(c => c.OperationTime)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<ChainRecord>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize
        };
    }

    public async Task<ChainRecord?> GetLastRecordAsync(Guid evidenceId)
    {
        return await _dbSet
            .Where(c => c.EvidenceId == evidenceId)
            .OrderByDescending(c => c.SequenceNumber)
            .FirstOrDefaultAsync();
    }

    public async Task<int> GetNextSequenceNumberAsync(Guid evidenceId)
    {
        var maxSeq = await _dbSet
            .Where(c => c.EvidenceId == evidenceId)
            .MaxAsync(c => (int?)c.SequenceNumber);
        return (maxSeq ?? 0) + 1;
    }

    public async Task<List<ChainRecord>> GetChainForwardAsync(Guid evidenceId, DateTime fromTime)
    {
        return await _dbSet
            .Where(c => c.EvidenceId == evidenceId && c.OperationTime >= fromTime)
            .OrderBy(c => c.SequenceNumber)
            .ToListAsync();
    }

    public async Task<List<ChainRecord>> GetChainBackwardAsync(Guid evidenceId, DateTime toTime)
    {
        return await _dbSet
            .Where(c => c.EvidenceId == evidenceId && c.OperationTime <= toTime)
            .OrderByDescending(c => c.SequenceNumber)
            .ToListAsync();
    }
}
