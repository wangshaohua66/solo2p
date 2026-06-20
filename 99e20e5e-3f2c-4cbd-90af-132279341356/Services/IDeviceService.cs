using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Device;

namespace FireIoTPlatform.Services;

public interface IDeviceService
{
    Task<ApiResponse<DeviceDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<DeviceDto>>> GetPagedAsync(DeviceQueryDto query);
    Task<ApiResponse<DeviceDto>> CreateAsync(DeviceCreateDto dto);
    Task<ApiResponse<bool>> UpdateAsync(long id, DeviceUpdateDto dto);
    Task<ApiResponse<bool>> DeleteAsync(long id);
    Task<ApiResponse<bool>> ReportDataAsync(DeviceDataReportDto dto);
    Task<ApiResponse<bool>> ReportHeartbeatAsync(DeviceHeartbeatDto dto);
    Task<ApiResponse<DeviceDashboardStatsDto>> GetDashboardStatsAsync(long? fireUnitId = null, string? districtCode = null);
    Task<ApiResponse<List<DeviceStatusDto>>> GetRealTimeStatusAsync(long? fireUnitId = null);
    Task<ApiResponse<bool>> BatchSetEnabledAsync(List<long> ids, bool enabled);
    Task<ApiResponse<string>> GenerateAuthTokenAsync(long deviceId);
}
