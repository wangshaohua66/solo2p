using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Alarm;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AlarmsController : ControllerBase
{
    private readonly IAlarmService _alarmService;

    public AlarmsController(IAlarmService alarmService)
    {
        _alarmService = alarmService;
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<AlarmRecordDto>> GetById(long id)
    {
        return await _alarmService.GetByIdAsync(id);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<AlarmRecordDto>>> GetPaged([FromQuery] AlarmQueryDto query)
    {
        return await _alarmService.GetPagedAsync(query);
    }

    [HttpPost("{deviceId}")]
    public async Task<ApiResponse<AlarmRecordDto>> Create(long deviceId, [FromBody] string description)
    {
        return await _alarmService.CreateAlarmAsync(deviceId, description);
    }

    [HttpPost("confirm")]
    public async Task<ApiResponse<bool>> Confirm([FromBody] AlarmConfirmDto dto)
    {
        return await _alarmService.ConfirmAlarmAsync(dto);
    }

    [HttpPost("process")]
    public async Task<ApiResponse<bool>> Process([FromBody] AlarmProcessDto dto)
    {
        return await _alarmService.ProcessAlarmAsync(dto);
    }

    [HttpPost("resolve")]
    public async Task<ApiResponse<bool>> Resolve([FromBody] AlarmResolveDto dto)
    {
        return await _alarmService.ResolveAlarmAsync(dto);
    }

    [HttpGet("{id}/intelligence")]
    public async Task<ApiResponse<FireIntelligenceDto>> GetFireIntelligence(long id)
    {
        return await _alarmService.GetFireIntelligenceAsync(id);
    }

    [HttpGet("statistics")]
    public async Task<ApiResponse<AlarmStatisticsDto>> GetStatistics([FromQuery] long? fireUnitId,
        [FromQuery] string? districtCode, [FromQuery] DateTime? startTime, [FromQuery] DateTime? endTime)
    {
        return await _alarmService.GetStatisticsAsync(fireUnitId, districtCode, startTime, endTime);
    }

    [HttpPost("aggregate")]
    public async Task<ApiResponse<bool>> Aggregate()
    {
        await _alarmService.AggregateAlarmsAsync();
        return ApiResponse<bool>.Success(true);
    }
}
