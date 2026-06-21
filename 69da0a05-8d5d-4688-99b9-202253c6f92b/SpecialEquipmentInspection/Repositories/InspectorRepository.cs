using Microsoft.EntityFrameworkCore;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Data;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Repositories;

public class InspectorRepository : IInspectorRepository
{
    private readonly AppDbContext _db;
    public InspectorRepository(AppDbContext db) => _db = db;

    public Task<Inspector?> GetByIdAsync(int id)
        => _db.Inspectors.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);

    public Task<Inspector?> GetByCertificateNoAsync(string certNo)
        => _db.Inspectors.AsNoTracking().FirstOrDefaultAsync(x => x.CertificateNo == certNo);

    public Task<bool> ExistsByCertificateNoAsync(string certNo, int? excludeId = null)
        => _db.Inspectors.AnyAsync(x => x.CertificateNo == certNo && (excludeId == null || x.Id != excludeId));

    public async Task<PagedResult<Inspector>> GetPagedAsync(InspectorStatus? status, string? keyword, int page, int pageSize)
    {
        var q = _db.Inspectors.AsNoTracking().AsQueryable();
        if (status.HasValue) q = q.Where(x => x.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(keyword))
            q = q.Where(x => x.Name.Contains(keyword) || x.CertificateNo.Contains(keyword));

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Inspector> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public async Task<Inspector> AddAsync(Inspector inspector)
    {
        inspector.CreatedAt = DateTime.Now;
        inspector.UpdatedAt = DateTime.Now;
        if (inspector.ExpiryDate < DateTime.Now) inspector.Status = InspectorStatus.Expired;
        _db.Inspectors.Add(inspector);
        await _db.SaveChangesAsync();
        return inspector;
    }

    public async Task UpdateAsync(Inspector inspector)
    {
        var existing = await _db.Inspectors.FindAsync(inspector.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(inspector);
        if (existing.ExpiryDate < DateTime.Now) existing.Status = InspectorStatus.Expired;
        else if (existing.Status == InspectorStatus.Expired) existing.Status = InspectorStatus.Active;
        existing.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
    }

    public Task<List<Inspector>> GetExpiringAsync(int withinDays)
    {
        var now = DateTime.Now;
        var deadline = now.AddDays(withinDays);
        return _db.Inspectors.AsNoTracking()
            .Where(x => x.Status == InspectorStatus.Active && x.ExpiryDate >= now && x.ExpiryDate <= deadline)
            .OrderBy(x => x.ExpiryDate)
            .ToListAsync();
    }

    public async Task<bool> CanInspectTypeAsync(int inspectorId, DeviceType type)
    {
        var inspector = await _db.Inspectors.AsNoTracking().FirstOrDefaultAsync(x => x.Id == inspectorId);
        if (inspector == null || inspector.Status != InspectorStatus.Active) return false;
        if (inspector.ExpiryDate < DateTime.Now) return false;
        var types = inspector.CertifiableTypes.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(t => int.TryParse(t.Trim(), out var v) ? v : 0).Where(v => v > 0).ToList();
        return types.Contains((int)type);
    }
}
