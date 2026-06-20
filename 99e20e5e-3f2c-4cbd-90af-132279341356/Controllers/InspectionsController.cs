using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Inspection;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class InspectionsController : ControllerBase
{
    private readonly IInspectionService _inspectionService;

    public InspectionsController(IInspectionService inspectionService)
    {
        _inspectionService = inspectionService;
    }

    [HttpGet("tasks/{id}")]
    public async Task<ApiResponse<InspectionTaskDto>> GetTaskById(long id)
    {
        return await _inspectionService.GetTaskByIdAsync(id);
    }

    [HttpGet("tasks")]
    public async Task<ApiResponse<PagedResult<InspectionTaskDto>>> GetTasks([FromQuery] InspectionTaskQueryDto query)
    {
        return await _inspectionService.GetTasksPagedAsync(query);
    }

    [HttpPost("tasks")]
    public async Task<ApiResponse<InspectionTaskDto>> CreateTask([FromBody] InspectionTaskCreateDto dto)
    {
        return await _inspectionService.CreateTaskAsync(dto);
    }

    [HttpPut("tasks/{id}")]
    public async Task<ApiResponse<bool>> UpdateTask(long id, [FromBody] InspectionTaskCreateDto dto)
    {
        return await _inspectionService.UpdateTaskAsync(id, dto);
    }

    [HttpDelete("tasks/{id}")]
    public async Task<ApiResponse<bool>> DeleteTask(long id)
    {
        return await _inspectionService.DeleteTaskAsync(id);
    }

    [HttpPost("records")]
    public async Task<ApiResponse<InspectionRecordDto>> CreateRecord([FromBody] InspectionRecordCreateDto dto)
    {
        return await _inspectionService.CreateRecordAsync(dto);
    }

    [HttpGet("tasks/{taskId}/records")]
    public async Task<ApiResponse<List<InspectionRecordDto>>> GetRecordsByTask(long taskId)
    {
        return await _inspectionService.GetRecordsByTaskAsync(taskId);
    }

    [HttpGet("hazards/{id}")]
    public async Task<ApiResponse<HazardRecordDto>> GetHazardById(long id)
    {
        return await _inspectionService.GetHazardByIdAsync(id);
    }

    [HttpGet("hazards")]
    public async Task<ApiResponse<PagedResult<HazardRecordDto>>> GetHazards([FromQuery] HazardQueryDto query)
    {
        return await _inspectionService.GetHazardsPagedAsync(query);
    }

    [HttpPost("hazards")]
    public async Task<ApiResponse<HazardRecordDto>> CreateHazard([FromBody] HazardRecordCreateDto dto)
    {
        return await _inspectionService.CreateHazardAsync(dto);
    }

    [HttpPost("hazards/rectify")]
    public async Task<ApiResponse<bool>> RectifyHazard([FromBody] HazardRectifyDto dto)
    {
        return await _inspectionService.RectifyHazardAsync(dto);
    }

    [HttpPost("hazards/accept")]
    public async Task<ApiResponse<bool>> AcceptHazard([FromBody] HazardAcceptDto dto)
    {
        return await _inspectionService.AcceptHazardAsync(dto);
    }

    [HttpPost("hazards/escalate")]
    public async Task<ApiResponse<bool>> EscalateOverdue()
    {
        return await _inspectionService.EscalateOverdueHazardsAsync();
    }

    [HttpGet("statistics")]
    public async Task<ApiResponse<InspectionStatisticsDto>> GetStatistics([FromQuery] long? fireUnitId, [FromQuery] string? districtCode)
    {
        return await _inspectionService.GetStatisticsAsync(fireUnitId, districtCode);
    }
}
