using Microsoft.EntityFrameworkCore;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Data;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Repositories;

public class DeviceRepository : IDeviceRepository
{
    private readonly AppDbContext _db;
    public DeviceRepository(AppDbContext db) => _db = db;

    public Task<Device?> GetByIdAsync(int id, bool track = false)
    {
        var q = _db.Devices.AsQueryable();
        if (!track) q = q.AsNoTracking();
        return q.FirstOrDefaultAsync(d => d.Id == id);
    }

    public Task<Device?> GetByCodeAsync(string code)
        => _db.Devices.AsNoTracking().FirstOrDefaultAsync(d => d.DeviceCode == code);

    public Task<bool> ExistsByCodeAsync(string code, int? excludeId = null)
        => _db.Devices.AnyAsync(d => d.DeviceCode == code && (excludeId == null || d.Id != excludeId));

    public async Task<PagedResult<Device>> GetPagedAsync(
        DeviceType? type = null,
        string? region = null,
        string? useUnitCode = null,
        DeviceStatus? status = null,
        string? keyword = null,
        int page = 1,
        int pageSize = 20)
    {
        var q = _db.Devices.AsNoTracking().AsQueryable();

        if (type.HasValue) q = q.Where(d => d.Type == type.Value);
        if (!string.IsNullOrWhiteSpace(region)) q = q.Where(d => d.Region == region);
        if (!string.IsNullOrWhiteSpace(useUnitCode)) q = q.Where(d => d.UseUnitCode == useUnitCode);
        if (status.HasValue) q = q.Where(d => d.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            q = q.Where(d => d.DeviceCode.Contains(keyword) || d.Name.Contains(keyword) || d.UseUnitName.Contains(keyword));
        }

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(d => d.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Device> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public Task<List<Device>> GetByUseUnitAsync(string useUnitCode)
        => _db.Devices.AsNoTracking().Where(d => d.UseUnitCode == useUnitCode).ToListAsync();

    public async Task<List<Device>> GetDevicesDueForInspectionAsync(int year)
    {
        var start = new DateTime(year, 1, 1);
        var end = new DateTime(year, 12, 31);
        return await _db.Devices.AsNoTracking()
            .Where(d => d.NextInspectionDate >= start && d.NextInspectionDate <= end)
            .OrderBy(d => d.NextInspectionDate)
            .ToListAsync();
    }

    public async Task<Device> AddAsync(Device device)
    {
        device.CreatedAt = DateTime.Now;
        device.UpdatedAt = DateTime.Now;
        _db.Devices.Add(device);
        await _db.SaveChangesAsync();
        return device;
    }

    public async Task UpdateAsync(Device device)
    {
        var existing = await _db.Devices.FindAsync(device.Id);
        if (existing == null) return;
        _db.Entry(existing).CurrentValues.SetValues(device);
        existing.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
    }

    public async Task UpdateStatusAsync(int id, DeviceStatus status)
    {
        var device = await _db.Devices.FindAsync(id);
        if (device == null) return;
        device.Status = status;
        device.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
    }

    public async Task<int> BatchAddAsync(IEnumerable<Device> devices)
    {
        var list = devices.ToList();
        var now = DateTime.Now;
        foreach (var d in list)
        {
            d.CreatedAt = now;
            d.UpdatedAt = now;
        }
        await _db.Devices.AddRangeAsync(list);
        return await _db.SaveChangesAsync();
    }

    public async Task<Dictionary<DeviceType, int>> CountByTypeAsync()
    {
        return await _db.Devices
            .GroupBy(d => d.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Type, x => x.Count);
    }

    public Task<List<string>> GetRegionsAsync()
        => _db.Devices.AsNoTracking().Select(d => d.Region).Distinct().ToListAsync();
}
