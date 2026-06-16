using Microsoft.EntityFrameworkCore;
using ColdChainLogistics.Data;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;

namespace ColdChainLogistics.Repositories.Implementations;

public class TraceabilityRepository : Repository<TraceabilityRecord>, ITraceabilityRepository
{
    public TraceabilityRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<List<TraceabilityRecord>> GetByBatchNumberAsync(string batchNumber)
    {
        return await _dbSet
            .Where(t => t.BatchNumber == batchNumber)
            .OrderBy(t => t.Sequence)
            .ThenBy(t => t.Timestamp)
            .ToListAsync();
    }

    public async Task<List<TraceabilityRecord>> GetByShipmentIdAsync(long shipmentId)
    {
        return await _dbSet
            .Where(t => t.ShipmentId == shipmentId)
            .OrderBy(t => t.Sequence)
            .ThenBy(t => t.Timestamp)
            .ToListAsync();
    }

    public async Task<TraceabilityRecord?> GetByTraceIdAsync(string traceId)
    {
        return await _dbSet.FirstOrDefaultAsync(t => t.TraceId == traceId);
    }
}

public class ReportRecordRepository : PagedRepository<ReportRecord>, IReportRecordRepository
{
    public ReportRecordRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<ReportRecord?> GetByReportNumberAsync(string reportNumber)
    {
        return await _dbSet.FirstOrDefaultAsync(r => r.ReportNumber == reportNumber);
    }

    public async Task<List<ReportRecord>> GetByCustomerIdAsync(long customerId, int pageIndex, int pageSize)
    {
        return await _dbSet
            .Where(r => r.CustomerId == customerId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }
}
