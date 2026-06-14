using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ColdChainMonitor.Application.Services;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize(Roles = "Admin")]
public class AuditController : ControllerBase
{
    private readonly AuditService _auditService;

    public AuditController(AuditService auditService)
    {
        _auditService = auditService;
    }

    [HttpGet]
    public async Task<ApiResponse<CursorPagedResult<AuditLogDto>>> GetLogs(
        [FromQuery] AuditActionType? actionType,
        [FromQuery] string? module,
        [FromQuery] string? operatorId,
        [FromQuery] string? operatorName,
        [FromQuery] string? entityType,
        [FromQuery] string? entityId,
        [FromQuery] DateTime? startTime,
        [FromQuery] DateTime? endTime,
        [FromQuery] bool? status,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 20,
        [FromQuery] bool sortDesc = true)
    {
        var request = new AuditLogQueryRequest
        {
            ActionType = actionType,
            Module = module,
            OperatorId = operatorId,
            OperatorName = operatorName,
            EntityType = entityType,
            EntityId = entityId,
            StartTime = startTime,
            EndTime = endTime,
            Status = status,
            Cursor = cursor,
            Limit = limit,
            SortDesc = sortDesc
        };

        var result = await _auditService.GetPagedAsync(request);
        return ApiResponse<CursorPagedResult<AuditLogDto>>.Success(result);
    }

    [HttpGet("count")]
    public async Task<ApiResponse<long>> GetCount(
        [FromQuery] AuditActionType? actionType,
        [FromQuery] string? module,
        [FromQuery] DateTime? startTime,
        [FromQuery] DateTime? endTime)
    {
        var count = await _auditService.GetCountAsync(actionType, module, startTime, endTime);
        return ApiResponse<long>.Success(count);
    }

    [HttpGet("modules")]
    public ApiResponse<List<string>> GetModules()
    {
        var modules = new List<string>
        {
            "Auth",
            "User",
            "Transport",
            "Device",
            "Monitor",
            "Alert",
            "Quality",
            "Audit",
            "Config"
        };
        return ApiResponse<List<string>>.Success(modules);
    }

    [HttpGet("action-types")]
    public ApiResponse<List<object>> GetActionTypes()
    {
        var types = Enum.GetValues(typeof(AuditActionType))
            .Cast<AuditActionType>()
            .Select(t => new
            {
                Value = (int)t,
                Name = t.ToString(),
                Text = GetActionTypeText(t)
            })
            .ToList<object>();

        return ApiResponse<List<object>>.Success(types);
    }

    private static string GetActionTypeText(AuditActionType type)
    {
        return type switch
        {
            AuditActionType.Create => "创建",
            AuditActionType.Update => "更新",
            AuditActionType.Delete => "删除",
            AuditActionType.StatusChange => "状态变更",
            AuditActionType.Login => "登录",
            AuditActionType.Logout => "登出",
            AuditActionType.ConfigChange => "配置变更",
            AuditActionType.ReportGenerate => "报表生成",
            _ => "未知"
        };
    }
}
