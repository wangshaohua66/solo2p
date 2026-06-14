using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Interfaces;

public interface IDeviceRepository : IRepository<Device>
{
    Task<Device?> GetByDeviceIdAsync(string deviceId);
    Task<List<Device>> GetByVehicleIdAsync(string vehicleId);
    Task UpdateStatusAsync(string deviceId, DeviceStatus status);
    Task UpdateLastReportAsync(string deviceId, DateTime reportTime, double? batteryLevel, GpsLocation? location);
    Task<List<Device>> GetOnlineDevicesAsync();
    Task<List<Device>> GetOfflineDevicesAsync(int offlineThresholdMinutes);
    Task<(int total, int active, int offline, int lowBattery, int inactive, int faulty)> GetStatusStatsAsync();
    Task<CursorPagedResult<Device>> GetPagedAsync(
        DeviceStatus? status,
        string? keyword,
        string? vehicleId,
        string? deviceType,
        string? cursor,
        int limit,
        bool sortDesc = true);
}
