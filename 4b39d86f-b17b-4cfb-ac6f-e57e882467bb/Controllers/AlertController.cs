using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "EnterpriseUser")]
[SwaggerTag("预警管理 - 预警通知、处理")]
public class AlertController : ControllerBase
{
    private readonly IAlertService _alertService;

    public AlertController(IAlertService alertService)
    {
        _alertService = alertService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取预警列表", Description = "分页查询预警通知，支持按类型、级别、状态等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<AlertDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<AlertDto>>>> GetAlerts([FromQuery] AlertQueryDto dto)
    {
        var result = await _alertService.GetAlertsAsync(dto);
        return Ok(new ApiResponse<PagedResult<AlertDto>> { Data = result });
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取预警详情", Description = "根据ID获取预警详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<AlertDto>))]
    [SwaggerResponse(404, "预警不存在")]
    public async Task<ActionResult<ApiResponse<AlertDto>>> GetAlert(int id)
    {
        var alert = await _alertService.GetAlertByIdAsync(id);
        if (alert == null)
            return NotFound(new ApiResponse<AlertDto> { Code = 404, Message = "预警不存在" });

        return Ok(new ApiResponse<AlertDto> { Data = alert });
    }

    [HttpPost("{id}/read")]
    [SwaggerOperation(Summary = "标记已读", Description = "将预警标记为已读")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<bool>))]
    [SwaggerResponse(404, "预警不存在")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAsRead(int id)
    {
        var result = await _alertService.MarkAsReadAsync(id);
        if (!result)
            return NotFound(new ApiResponse<bool> { Code = 404, Message = "预警不存在", Data = false });

        return Ok(new ApiResponse<bool> { Data = result });
    }

    [HttpPost("{id}/handle")]
    [SwaggerOperation(Summary = "标记已处理", Description = "处理预警并填写处理结果")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<bool>))]
    [SwaggerResponse(404, "预警不存在")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAsHandled(int id, [FromBody] AlertHandleDto dto)
    {
        var result = await _alertService.MarkAsHandledAsync(id, dto);
        if (!result)
            return NotFound(new ApiResponse<bool> { Code = 404, Message = "预警不存在", Data = false });

        return Ok(new ApiResponse<bool> { Data = result });
    }

    [HttpGet("unread-count")]
    [SwaggerOperation(Summary = "获取未读预警数量", Description = "获取当前用户或角色的未读预警数量")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<int>))]
    public async Task<ActionResult<ApiResponse<int>>> GetUnreadCount()
    {
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var result = await _alertService.GetUnreadCountAsync(null, role);
        return Ok(new ApiResponse<int> { Data = result });
    }

    [HttpPost("check-inventory")]
    [Authorize(Policy = "AdminOnly")]
    [SwaggerOperation(Summary = "检查库存预警", Description = "手动触发库存预警检查")]
    [SwaggerResponse(200, "检查完成", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> CheckInventoryAlerts()
    {
        await _alertService.CheckAndGenerateInventoryAlertsAsync();
        return Ok(new ApiResponse { Message = "库存预警检查完成" });
    }

    [HttpPost("check-transport")]
    [Authorize(Policy = "AdminOnly")]
    [SwaggerOperation(Summary = "检查运输预警", Description = "手动触发运输预警检查")]
    [SwaggerResponse(200, "检查完成", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> CheckTransportAlerts()
    {
        await _alertService.CheckAndGenerateTransportAlertsAsync();
        return Ok(new ApiResponse { Message = "运输预警检查完成" });
    }

    [HttpPost("check-hazard")]
    [Authorize(Policy = "AdminOnly")]
    [SwaggerOperation(Summary = "检查隐患预警", Description = "手动触发隐患预警检查")]
    [SwaggerResponse(200, "检查完成", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> CheckHazardAlerts()
    {
        await _alertService.CheckAndGenerateHazardAlertsAsync();
        return Ok(new ApiResponse { Message = "隐患预警检查完成" });
    }

    [HttpPost("check-drill")]
    [Authorize(Policy = "AdminOnly")]
    [SwaggerOperation(Summary = "检查演练预警", Description = "手动触发演练预警检查")]
    [SwaggerResponse(200, "检查完成", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> CheckDrillAlerts()
    {
        await _alertService.CheckAndGenerateDrillAlertsAsync();
        return Ok(new ApiResponse { Message = "演练预警检查完成" });
    }

    [HttpPost("check-certificate")]
    [Authorize(Policy = "AdminOnly")]
    [SwaggerOperation(Summary = "检查证书预警", Description = "手动触发证书预警检查")]
    [SwaggerResponse(200, "检查完成", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> CheckCertificateAlerts()
    {
        await _alertService.CheckAndGenerateCertificateAlertsAsync();
        return Ok(new ApiResponse { Message = "证书预警检查完成" });
    }
}
