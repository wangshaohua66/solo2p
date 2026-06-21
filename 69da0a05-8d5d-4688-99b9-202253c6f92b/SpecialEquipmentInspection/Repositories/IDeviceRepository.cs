using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Repositories;

public interface IDeviceRepository
{
    Task<Device?> GetByIdAsync(int id, bool track = false);
    Task<Device?> GetByCodeAsync(string code);
    Task<bool> ExistsByCodeAsync(string code, int? excludeId = null);
    Task<PagedResult<Device>> GetPagedAsync(
        DeviceType? type = null,
        string? region = null,
        string? useUnitCode = null,
        DeviceStatus? status = null,
        string? keyword = null,
        int page = 1,
        int pageSize = 20);
    Task<List<Device>> GetByUseUnitAsync(string useUnitCode);
    Task<List<Device>> GetDevicesDueForInspectionAsync(int year);
    Task<Device> AddAsync(Device device);
    Task UpdateAsync(Device device);
    Task UpdateStatusAsync(int id, DeviceStatus status);
    Task<int> BatchAddAsync(IEnumerable<Device> devices);
    Task<Dictionary<DeviceType, int>> CountByTypeAsync();
    Task<List<string>> GetRegionsAsync();
}
