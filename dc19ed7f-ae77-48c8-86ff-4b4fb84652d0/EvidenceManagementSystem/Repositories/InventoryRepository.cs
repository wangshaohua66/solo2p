using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class InventoryRepository : Repository<InventoryTask>, IInventoryRepository
{
    public InventoryRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<PagedResult<InventoryTask>> SearchAsync(InventoryQuery query)
    {
        var q = _dbSet.AsQueryable();

        if (query.Status.HasValue)
            q = q.Where(i => i.Status == query.Status.Value);
        if (!string.IsNullOrEmpty(query.Warehouse))
            q = q.Where(i => i.Warehouse != null && i.Warehouse.Contains(query.Warehouse));
        if (query.Category.HasValue)
            q = q.Where(i => i.Category == query.Category.Value);
        if (!string.IsNullOrEmpty(query.CaseNumber))
            q = q.Where(i => i.CaseNumber != null && i.CaseNumber.Contains(query.CaseNumber));
        if (query.StartDate.HasValue)
            q = q.Where(i => i.CreatedAt >= query.StartDate.Value);
        if (query.EndDate.HasValue)
            q = q.Where(i => i.CreatedAt <= query.EndDate.Value);

        var totalCount = await q.CountAsync();

        var items = await q
            .OrderByDescending(i => i.CreatedAt)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<InventoryTask>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize
        };
    }

    public async Task<InventoryTask?> GetByTaskNumberAsync(string taskNumber)
    {
        return await _dbSet
            .Include(i => i.InventoryItems)
            .FirstOrDefaultAsync(i => i.TaskNumber == taskNumber);
    }

    public async Task<InventoryItem?> GetItemByBarcodeAsync(Guid taskId, string barcode)
    {
        return await _context.InventoryItems
            .FirstOrDefaultAsync(i => i.InventoryTaskId == taskId && i.Barcode == barcode);
    }

    public async Task<List<InventoryItem>> GetItemsByTaskIdAsync(Guid taskId)
    {
        return await _context.InventoryItems
            .Where(i => i.InventoryTaskId == taskId)
            .OrderBy(i => i.Barcode)
            .ToListAsync();
    }

    public async Task AddItemAsync(InventoryItem item)
    {
        await _context.InventoryItems.AddAsync(item);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateItemAsync(InventoryItem item)
    {
        _context.InventoryItems.Update(item);
        await _context.SaveChangesAsync();
    }
}
