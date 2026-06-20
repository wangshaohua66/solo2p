using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Alarm;

namespace FireIoTPlatform.Services;

public interface IAlarmService
{
    Task<ApiResponse<AlarmRecordDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<AlarmRecordDto>>> GetPagedAsync(AlarmQueryDto query);
    Task<ApiResponse<AlarmRecordDto>> CreateAlarmAsync(long deviceId, string description, decimal? alarmValue = null);
    Task<ApiResponse<bool>> ConfirmAlarmAsync(AlarmConfirmDto dto);
    Task<ApiResponse<bool>> ProcessAlarmAsync(AlarmProcessDto dto);
    Task<ApiResponse<bool>> ResolveAlarmAsync(AlarmResolveDto dto);
    Task<ApiResponse<FireIntelligenceDto>> GetFireIntelligenceAsync(long alarmId);
    Task<ApiResponse<AlarmStatisticsDto>> GetStatisticsAsync(long? fireUnitId = null, string? districtCode = null,
        DateTime? startTime = null, DateTime? endTime = null);
    Task ProcessDeviceAlarmAsync(long deviceId);
    Task AggregateAlarmsAsync();
}
