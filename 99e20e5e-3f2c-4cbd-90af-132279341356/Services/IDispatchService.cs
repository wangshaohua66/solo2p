using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Dispatch;
using FireIoTPlatform.Models.DTOs.Unit;

namespace FireIoTPlatform.Services;

public interface IDispatchService
{
    Task<ApiResponse<RescueDispatchDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<RescueDispatchDto>>> GetPagedAsync(DispatchQueryDto query);
    Task<ApiResponse<RescueDispatchDto>> CreateDispatchAsync(DispatchCreateDto dto);
    Task<ApiResponse<bool>> UpdateStatusAsync(DispatchStatusUpdateDto dto);
    Task<ApiResponse<bool>> SubmitReportAsync(DispatchReportDto dto);
    Task<ApiResponse<List<NearbyStationDto>>> FindNearbyStationsAsync(decimal latitude, decimal longitude, int count = 3);
    Task<ApiResponse<List<FireStationDto>>> GetAllStationsAsync();
    Task<ApiResponse<FireStationDto>> GetStationByIdAsync(long id);
    Task<ApiResponse<List<FirefighterDto>>> GetFirefightersByStationAsync(long stationId);
    Task<ApiResponse<FireStationDto>> CreateStationAsync(FireStationDto dto);
    Task<ApiResponse<bool>> UpdateStationAsync(long id, FireStationDto dto);
    Task<ApiResponse<FirefighterDto>> CreateFirefighterAsync(FirefighterDto dto);
    Task AutoDispatchForAlarmAsync(long alarmId);
    Task<ApiResponse<bool>> UpdateRoadConditionAsync(long dispatchId, string roadCondition);
    Task<ApiResponse<bool>> UpdateLiveVideoAsync(long dispatchId, string liveVideoUrl);
}

public interface IFireUnitService
{
    Task<ApiResponse<FireUnitDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<FireUnitDto>>> GetPagedAsync(FireUnitQueryDto query);
    Task<ApiResponse<FireUnitDto>> CreateAsync(FireUnitCreateDto dto);
    Task<ApiResponse<bool>> UpdateAsync(long id, FireUnitCreateDto dto);
    Task<ApiResponse<bool>> DeleteAsync(long id);
    Task<ApiResponse<WaterSystemStatusDto>> GetWaterSystemStatusAsync(long fireUnitId);
    Task<ApiResponse<List<WaterSystemStatusDto>>> GetWaterSystemStatusListAsync(string? districtCode = null);
}
