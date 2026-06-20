using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Device;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class DevicesController : ControllerBase
{
    private readonly IDeviceService _deviceService;

    public DevicesController(IDeviceService deviceService)
    {
        _deviceService = deviceService;
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<DeviceDto>> GetById(long id)
    {
        return await _deviceService.GetByIdAsync(id);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<DeviceDto>>> GetPaged([FromQuery] DeviceQueryDto query)
    {
        return await _deviceService.GetPagedAsync(query);
    }

    [HttpPost]
    public async Task<ApiResponse<DeviceDto>> Create([FromBody] DeviceCreateDto dto)
    {
        return await _deviceService.CreateAsync(dto);
    }

    [HttpPut("{id}")]
    public async Task<ApiResponse<bool>> Update(long id, [FromBody] DeviceUpdateDto dto)
    {
        return await _deviceService.UpdateAsync(id, dto);
    }

    [HttpDelete("{id}")]
    public async Task<ApiResponse<bool>> Delete(long id)
    {
        return await _deviceService.DeleteAsync(id);
    }

    [HttpPost("report")]
    public async Task<ApiResponse<bool>> ReportData([FromBody] DeviceDataReportDto dto)
    {
        return await _deviceService.ReportDataAsync(dto);
    }

    [HttpPost("heartbeat")]
    public async Task<ApiResponse<bool>> ReportHeartbeat([FromBody] DeviceHeartbeatDto dto)
    {
        return await _deviceService.ReportHeartbeatAsync(dto);
    }

    [HttpGet("dashboard/stats")]
    public async Task<ApiResponse<DeviceDashboardStatsDto>> GetDashboardStats([FromQuery] long? fireUnitId, [FromQuery] string? districtCode)
    {
        return await _deviceService.GetDashboardStatsAsync(fireUnitId, districtCode);
    }

    [HttpGet("realtime")]
    public async Task<ApiResponse<List<DeviceStatusDto>>> GetRealTimeStatus([FromQuery] long? fireUnitId)
    {
        return await _deviceService.GetRealTimeStatusAsync(fireUnitId);
    }

    [HttpPut("batch/enabled")]
    public async Task<ApiResponse<bool>> BatchSetEnabled([FromBody] List<long> ids, [FromQuery] bool enabled)
    {
        return await _deviceService.BatchSetEnabledAsync(ids, enabled);
    }

    [HttpPost("{id}/token")]
    public async Task<ApiResponse<string>> GenerateAuthToken(long id)
    {
        return await _deviceService.GenerateAuthTokenAsync(id);
    }
}
