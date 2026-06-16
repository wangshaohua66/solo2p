using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class EvidenceRepository : Repository<Evidence>, IEvidenceRepository
{
    public EvidenceRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Evidence?> GetByBarcodeAsync(string barcode)
    {
        return await _dbSet.FirstOrDefaultAsync(e => e.Barcode == barcode);
    }

    public async Task<PagedResult<Evidence>> SearchAsync(EvidenceQuery query)
    {
        var q = _dbSet.AsQueryable();

        if (query.Category.HasValue)
            q = q.Where(e => e.Category == query.Category.Value);
        if (query.Status.HasValue)
            q = q.Where(e => e.Status == query.Status.Value);
        if (!string.IsNullOrEmpty(query.Barcode))
            q = q.Where(e => e.Barcode.Contains(query.Barcode));
        if (!string.IsNullOrEmpty(query.CaseNumber))
            q = q.Where(e => e.CaseNumber != null && e.CaseNumber.Contains(query.CaseNumber));
        if (!string.IsNullOrEmpty(query.Keyword))
            q = q.Where(e => e.Name.Contains(query.Keyword) ||
                            (e.CaseNumber != null && e.CaseNumber.Contains(query.Keyword)) ||
                            e.Barcode.Contains(query.Keyword));
        if (query.StartDate.HasValue)
            q = q.Where(e => e.CreatedAt >= query.StartDate.Value);
        if (query.EndDate.HasValue)
            q = q.Where(e => e.CreatedAt <= query.EndDate.Value);
        if (query.IsOverdue.HasValue)
            q = q.Where(e => e.IsOverdue == query.IsOverdue.Value);

        var totalCount = await q.CountAsync();

        if (!string.IsNullOrEmpty(query.SortBy))
        {
            q = query.SortDesc
                ? q.OrderByDescending(e => EF.Property<object>(e, query.SortBy))
                : q.OrderBy(e => EF.Property<object>(e, query.SortBy));
        }
        else
        {
            q = q.OrderByDescending(e => e.CreatedAt);
        }

        var items = await q
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<Evidence>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize
        };
    }

    public async Task<int> GetCountByStatusAsync(EvidenceStatus status)
    {
        return await _dbSet.CountAsync(e => e.Status == status);
    }

    public async Task<int> GetCountByCategoryAsync(EvidenceCategory category)
    {
        return await _dbSet.CountAsync(e => e.Category == category);
    }

    public async Task<List<Evidence>> GetOverdueEvidencesAsync()
    {
        return await _dbSet
            .Where(e => e.IsOverdue && !e.IsDestroyed)
            .OrderBy(e => e.ExpectedExpiryDate)
            .ToListAsync();
    }

    public async Task<List<Evidence>> GetWarningEvidencesAsync(int daysBeforeExpiry)
    {
        var warningDate = DateTime.UtcNow.AddDays(daysBeforeExpiry);
        return await _dbSet
            .Where(e => e.ExpectedExpiryDate.HasValue &&
                       e.ExpectedExpiryDate <= warningDate &&
                       e.ExpectedExpiryDate > DateTime.UtcNow &&
                       !e.IsOverdue &&
                       !e.IsDestroyed)
            .OrderBy(e => e.ExpectedExpiryDate)
            .ToListAsync();
    }

    public async Task<bool> BarcodeExistsAsync(string barcode)
    {
        return await _dbSet.AnyAsync(e => e.Barcode == barcode);
    }
}
