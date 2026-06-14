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
public class MonitorController : ControllerBase
{
    private readonly MonitorService _monitorService;
    private readonly AlertService _alertService;
    private readonly AuditService _auditService;

    public MonitorController(
        MonitorService monitorService,
        AlertService alertService,
        AuditService auditService)
    {
        _monitorService = monitorService;
        _alertService = alertService;
        _auditService = auditService;
    }

    [HttpPost("temperature/report")]
    [AllowAnonymous]
    public async Task<ApiResponse> ReportTemperature([FromBody] TemperatureReportRequest request)
    {
        if (string.IsNullOrEmpty(request.DeviceId))
        {
            return ApiResponse.Error(3001, "设备ID不能为空");
        }

        await _monitorService.ReportTemperatureAsync(request);
        return ApiResponse.Success("上报成功");
    }

    [HttpPost("temperature/batch-report")]
    [AllowAnonymous]
    public async Task<ApiResponse> BatchReportTemperature([FromBody] List<TemperatureReportRequest> requests)
    {
        if (requests == null || requests.Count == 0)
        {
            return ApiResponse.Error(3002, "上报数据不能为空");
        }

        foreach (var request in requests)
        {
            if (!string.IsNullOrEmpty(request.DeviceId))
            {
                await _monitorService.ReportTemperatureAsync(request);
            }
        }

        return ApiResponse.Success("批量上报成功");
    }

    [HttpGet("real-time")]
    [Authorize]
    public async Task<ApiResponse<List<RealTimeMonitorDto>>> GetRealTimeStatus(
        [FromQuery] string? deviceId,
        [FromQuery] string? vehicleId)
    {
        var result = await _monitorService.GetRealTimeStatusAsync(deviceId, vehicleId);
        return ApiResponse<List<RealTimeMonitorDto>>.Success(result);
    }

    [HttpGet("temperature/history")]
    [Authorize]
    public async Task<ApiResponse<CursorPagedResult<TemperatureReadingDto>>> GetTemperatureHistory(
        [FromQuery] string deviceId,
        [FromQuery] DateTime startTime,
        [FromQuery] DateTime endTime,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 100)
    {
        var query = new TemperatureHistoryQuery
        {
            DeviceId = deviceId,
            StartTime = startTime,
            EndTime = endTime,
            Cursor = cursor,
            Limit = limit
        };

        var result = await _monitorService.GetTemperatureHistoryAsync(query);
        return ApiResponse<CursorPagedResult<TemperatureReadingDto>>.Success(result);
    }

    [HttpGet("temperature/stats")]
    [Authorize]
    public async Task<ApiResponse<TemperatureStatsDto>> GetTemperatureStats(
        [FromQuery] string deviceId,
        [FromQuery] DateTime startTime,
        [FromQuery] DateTime endTime)
    {
        var result = await _monitorService.GetTemperatureStatsAsync(deviceId, startTime, endTime);
        return ApiResponse<TemperatureStatsDto>.Success(result);
    }

    [HttpGet("alerts")]
    [Authorize]
    public async Task<ApiResponse<CursorPagedResult<AlertDto>>> GetAlerts(
        [FromQuery] AlertLevel? alertLevel,
        [FromQuery] AlertType? alertType,
        [FromQuery] bool? isAcknowledged,
        [FromQuery] bool? isResolved,
        [FromQuery] string? deviceId,
        [FromQuery] string? transportTaskId,
        [FromQuery] DateTime? startTime,
        [FromQuery] DateTime? endTime,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 20,
        [FromQuery] bool sortDesc = true)
    {
        var request = new AlertQueryRequest
        {
            AlertLevel = alertLevel,
            AlertType = alertType,
            IsAcknowledged = isAcknowledged,
            IsResolved = isResolved,
            DeviceId = deviceId,
            TransportTaskId = transportTaskId,
            StartTime = startTime,
            EndTime = endTime,
            Cursor = cursor,
            Limit = limit,
            SortDesc = sortDesc
        };

        var result = await _alertService.GetPagedAsync(request);
        return ApiResponse<CursorPagedResult<AlertDto>>.Success(result);
    }

    [HttpGet("alerts/{id}")]
    [Authorize]
    public async Task<ApiResponse<AlertDto>> GetAlertById(string id)
    {
        var alert = await _alertService.GetByIdAsync(id);
        if (alert == null)
        {
            return ApiResponse<AlertDto>.Error(3003, "预警不存在");
        }
        return ApiResponse<AlertDto>.Success(alert);
    }

    [HttpPost("alerts/{id}/acknowledge")]
    [Authorize]
    public async Task<ApiResponse<AlertDto>> AcknowledgeAlert(string id, [FromBody] AcknowledgeAlertRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        var alert = await _alertService.AcknowledgeAsync(id, userId!, userName!, request.Remark);
        if (alert == null)
        {
            return ApiResponse<AlertDto>.Error(3003, "预警不存在");
        }

        await _auditService.LogAsync(
            AuditActionType.Update,
            "确认预警",
            "Monitor",
            entityType: "Alert",
            entityId: id,
            operatorId: userId,
            operatorName: userName,
            status: true);

        return ApiResponse<AlertDto>.Success(alert, "预警已确认");
    }

    [HttpPost("alerts/{id}/resolve")]
    [Authorize]
    public async Task<ApiResponse<AlertDto>> ResolveAlert(string id, [FromBody] ResolveAlertRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        var alert = await _alertService.ResolveAsync(id, userId!, userName!, request.Remark);
        if (alert == null)
        {
            return ApiResponse<AlertDto>.Error(3003, "预警不存在");
        }

        await _auditService.LogAsync(
            AuditActionType.Update,
            "解除预警",
            "Monitor",
            entityType: "Alert",
            entityId: id,
            operatorId: userId,
            operatorName: userName,
            status: true);

        return ApiResponse<AlertDto>.Success(alert, "预警已解除");
    }

    [HttpGet("alerts/unacknowledged/count")]
    [Authorize]
    public async Task<ApiResponse<int>> GetUnacknowledgedCount()
    {
        var count = await _alertService.GetUnacknowledgedCountAsync();
        return ApiResponse<int>.Success(count);
    }

    [HttpGet("alert-rules")]
    [Authorize(Roles = "Admin,Dispatcher")]
    public async Task<ApiResponse<List<AlertRuleDto>>> GetAlertRules()
    {
        var rules = await _alertService.GetRulesAsync();
        return ApiResponse<List<AlertRuleDto>>.Success(rules);
    }

    [HttpGet("alert-rules/{id}")]
    [Authorize(Roles = "Admin,Dispatcher")]
    public async Task<ApiResponse<AlertRuleDto>> GetAlertRuleById(string id)
    {
        var rule = await _alertService.GetRuleByIdAsync(id);
        if (rule == null)
        {
            return ApiResponse<AlertRuleDto>.Error(3004, "预警规则不存在");
        }
        return ApiResponse<AlertRuleDto>.Success(rule);
    }

    [HttpPost("alert-rules")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<AlertRuleDto>> CreateAlertRule([FromBody] CreateAlertRuleRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        var rule = await _alertService.CreateRuleAsync(request, userId!, userName!);
        return ApiResponse<AlertRuleDto>.Success(rule, "规则创建成功");
    }

    [HttpPut("alert-rules/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<AlertRuleDto>> UpdateAlertRule(string id, [FromBody] UpdateAlertRuleRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        var rule = await _alertService.UpdateRuleAsync(id, request, userId!, userName!);
        if (rule == null)
        {
            return ApiResponse<AlertRuleDto>.Error(3004, "预警规则不存在");
        }
        return ApiResponse<AlertRuleDto>.Success(rule, "规则更新成功");
    }

    [HttpDelete("alert-rules/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> DeleteAlertRule(string id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.FindFirst("realName")?.Value;

        var result = await _alertService.DeleteRuleAsync(id, userId!, userName!);
        if (!result)
        {
            return ApiResponse.Error(3004, "预警规则不存在");
        }
        return ApiResponse.Success("规则删除成功");
    }

    [HttpPost("alert-rules/refresh-cache")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> RefreshAlertRulesCache()
    {
        await _alertService.RefreshRulesCacheAsync();
        return ApiResponse.Success("规则缓存刷新成功");
    }

    [HttpPost("check-offline")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> CheckDeviceOfflineStatus()
    {
        await _monitorService.CheckDeviceOfflineStatusAsync();
        return ApiResponse.Success("离线检查完成");
    }
}
