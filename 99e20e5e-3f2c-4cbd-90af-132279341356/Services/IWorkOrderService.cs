using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.WorkOrder;

namespace FireIoTPlatform.Services;

public interface IWorkOrderService
{
    Task<ApiResponse<WorkOrderDto>> GetByIdAsync(long id);
    Task<ApiResponse<PagedResult<WorkOrderDto>>> GetPagedAsync(WorkOrderQueryDto query);
    Task<ApiResponse<WorkOrderDto>> CreateAsync(WorkOrderCreateDto dto);
    Task<ApiResponse<bool>> UpdateAsync(long id, WorkOrderUpdateDto dto);
    Task<ApiResponse<bool>> DeleteAsync(long id);
    Task<ApiResponse<bool>> AssignAsync(WorkOrderAssignDto dto);
    Task<ApiResponse<bool>> StartAsync(WorkOrderStartDto dto);
    Task<ApiResponse<bool>> CompleteAsync(WorkOrderCompleteDto dto);
    Task<ApiResponse<bool>> EscalateAsync(long workOrderId, string? reason = null);
    Task<ApiResponse<WorkOrderStatisticsDto>> GetStatisticsAsync(long? fireUnitId = null, string? districtCode = null);
    Task<ApiResponse<bool>> CheckOverdueOrdersAsync();
    Task CreateMaintenanceWorkOrderFromAlarmAsync(long alarmId);
}
