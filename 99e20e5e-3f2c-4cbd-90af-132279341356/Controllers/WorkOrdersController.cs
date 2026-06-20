using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.WorkOrder;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class WorkOrdersController : ControllerBase
{
    private readonly IWorkOrderService _workOrderService;

    public WorkOrdersController(IWorkOrderService workOrderService)
    {
        _workOrderService = workOrderService;
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<WorkOrderDto>> GetById(long id)
    {
        return await _workOrderService.GetByIdAsync(id);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<WorkOrderDto>>> GetPaged([FromQuery] WorkOrderQueryDto query)
    {
        return await _workOrderService.GetPagedAsync(query);
    }

    [HttpPost]
    public async Task<ApiResponse<WorkOrderDto>> Create([FromBody] WorkOrderCreateDto dto)
    {
        return await _workOrderService.CreateAsync(dto);
    }

    [HttpPut("{id}")]
    public async Task<ApiResponse<bool>> Update(long id, [FromBody] WorkOrderUpdateDto dto)
    {
        return await _workOrderService.UpdateAsync(id, dto);
    }

    [HttpDelete("{id}")]
    public async Task<ApiResponse<bool>> Delete(long id)
    {
        return await _workOrderService.DeleteAsync(id);
    }

    [HttpPost("assign")]
    public async Task<ApiResponse<bool>> Assign([FromBody] WorkOrderAssignDto dto)
    {
        return await _workOrderService.AssignAsync(dto);
    }

    [HttpPost("start")]
    public async Task<ApiResponse<bool>> Start([FromBody] WorkOrderStartDto dto)
    {
        return await _workOrderService.StartAsync(dto);
    }

    [HttpPost("complete")]
    public async Task<ApiResponse<bool>> Complete([FromBody] WorkOrderCompleteDto dto)
    {
        return await _workOrderService.CompleteAsync(dto);
    }

    [HttpPost("{id}/escalate")]
    public async Task<ApiResponse<bool>> Escalate(long id, [FromBody] string? reason)
    {
        return await _workOrderService.EscalateAsync(id, reason);
    }

    [HttpGet("statistics")]
    public async Task<ApiResponse<WorkOrderStatisticsDto>> GetStatistics([FromQuery] long? fireUnitId,
        [FromQuery] string? districtCode)
    {
        return await _workOrderService.GetStatisticsAsync(fireUnitId, districtCode);
    }

    [HttpPost("check-overdue")]
    public async Task<ApiResponse<bool>> CheckOverdue()
    {
        return await _workOrderService.CheckOverdueOrdersAsync();
    }
}
