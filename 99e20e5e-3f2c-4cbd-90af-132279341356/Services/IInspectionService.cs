using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Inspection;

namespace FireIoTPlatform.Services;

public interface IInspectionService
{
    Task<ApiResponse<InspectionTaskDto>> GetTaskByIdAsync(long id);
    Task<ApiResponse<PagedResult<InspectionTaskDto>>> GetTasksPagedAsync(InspectionTaskQueryDto query);
    Task<ApiResponse<InspectionTaskDto>> CreateTaskAsync(InspectionTaskCreateDto dto);
    Task<ApiResponse<bool>> UpdateTaskAsync(long id, InspectionTaskCreateDto dto);
    Task<ApiResponse<bool>> DeleteTaskAsync(long id);
    Task<ApiResponse<InspectionRecordDto>> CreateRecordAsync(InspectionRecordCreateDto dto);
    Task<ApiResponse<List<InspectionRecordDto>>> GetRecordsByTaskAsync(long taskId);
    Task<ApiResponse<HazardRecordDto>> GetHazardByIdAsync(long id);
    Task<ApiResponse<PagedResult<HazardRecordDto>>> GetHazardsPagedAsync(HazardQueryDto query);
    Task<ApiResponse<HazardRecordDto>> CreateHazardAsync(HazardRecordCreateDto dto);
    Task<ApiResponse<bool>> RectifyHazardAsync(HazardRectifyDto dto);
    Task<ApiResponse<bool>> AcceptHazardAsync(HazardAcceptDto dto);
    Task<ApiResponse<bool>> EscalateOverdueHazardsAsync();
    Task<ApiResponse<InspectionStatisticsDto>> GetStatisticsAsync(long? fireUnitId = null, string? districtCode = null);
    Task GenerateRecurringTasksAsync();
}
