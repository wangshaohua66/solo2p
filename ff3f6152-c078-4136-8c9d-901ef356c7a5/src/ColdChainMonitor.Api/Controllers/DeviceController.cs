using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ColdChainMonitor.Application.Services;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class DeviceController : ControllerBase
{
    private readonly DeviceService _deviceService;
    private readonly AuditService _auditService;

    public DeviceController(DeviceService deviceService, AuditService auditService)
    {
        _deviceService = deviceService;
        _auditService = auditService;
    }

    [HttpGet]
    public async Task<ApiResponse<CursorPagedResult<DeviceDto>>> GetDevices(
        [FromQuery] DeviceStatus? status,
        [FromQuery] string? keyword,
        [FromQuery] string? vehicleId,
        [FromQuery] bool? isOnline,
        [FromQuery] string? deviceType,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 20,
        [FromQuery] string? sortBy,
        [FromQuery] bool sortDesc = true)
    {
        var request = new DeviceQueryRequest
        {
            Status = status,
            Keyword = keyword,
            VehicleId = vehicleId,
            IsOnline = isOnline,
            DeviceType = deviceType,
            Cursor = cursor,
            Limit = limit,
            SortBy = sortBy,
            SortDesc = sortDesc
        };

        var result = await _deviceService.GetPagedAsync(request);
        return ApiResponse<CursorPagedResult<DeviceDto>>.Success(result);
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<DeviceDto>> GetById(string id)
    {
        var device = await _deviceService.GetByIdAsync(id);
        if (device == null)
        {
            return ApiResponse<DeviceDto>.Error(4001, "设备不存在");
        }
        return ApiResponse<DeviceDto>.Success(device);
    }

    [HttpGet("deviceId/{deviceId}")]
    public async Task<ApiResponse<DeviceDto>> GetByDeviceId(string deviceId)
    {
        var device = await _deviceService.GetByDeviceIdAsync(deviceId);
        if (device == null)
        {
            return ApiResponse<DeviceDto>.Error(4001, "设备不存在");
        }
        return ApiResponse<DeviceDto>.Success(device);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<DeviceDto>> Create([FromBody] CreateDeviceRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        try
        {
            var device = await _deviceService.CreateAsync(request, operatorId!, operatorName!);
            return ApiResponse<DeviceDto>.Success(device, "设备创建成功");
        }
        catch (InvalidOperationException ex)
        {
            return ApiResponse<DeviceDto>.Error(4002, ex.Message);
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<DeviceDto>> Update(string id, [FromBody] UpdateDeviceRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var device = await _deviceService.UpdateAsync(id, request, operatorId!, operatorName!);
        if (device == null)
        {
            return ApiResponse<DeviceDto>.Error(4001, "设备不存在");
        }
        return ApiResponse<DeviceDto>.Success(device, "设备更新成功");
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> Delete(string id)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var result = await _deviceService.DeleteAsync(id, operatorId!, operatorName!);
        if (!result)
        {
            return ApiResponse.Error(4001, "设备不存在");
        }
        return ApiResponse.Success("设备删除成功");
    }

    [HttpPost("bind-vehicle")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> BindVehicle([FromBody] BindDeviceVehicleRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var result = await _deviceService.BindVehicleAsync(request, operatorId!, operatorName!);
        if (!result)
        {
            return ApiResponse.Error(4003, "设备绑定失败");
        }
        return ApiResponse.Success("设备绑定成功");
    }

    [HttpGet("stats/status")]
    public async Task<ApiResponse<DeviceStatusStatsDto>> GetStatusStats()
    {
        var stats = await _deviceService.GetStatusStatsAsync();
        return ApiResponse<DeviceStatusStatsDto>.Success(stats);
    }

    [HttpGet("vehicle/{vehicleId}")]
    public async Task<ApiResponse<List<DeviceDto>>> GetByVehicleId(string vehicleId)
    {
        var devices = await _deviceService.GetByVehicleIdAsync(vehicleId);
        return ApiResponse<List<DeviceDto>>.Success(devices);
    }
}
