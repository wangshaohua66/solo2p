using Microsoft.AspNetCore.Mvc;
using Serilog;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AlertRuleController : ControllerBase
{
    private readonly IAlertRuleService _alertRuleService;
    private readonly IAlertService _alertService;

    public AlertRuleController(IAlertRuleService alertRuleService, IAlertService alertService)
    {
        _alertRuleService = alertRuleService;
        _alertService = alertService;
    }

    /// <summary>
    /// 创建报警规则
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<AlertRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<AlertRuleDto>>> Create([FromBody] AlertRuleCreateRequest request)
    {
        Log.Information("创建报警规则: RuleName={RuleName}, CustomerId={CustomerId}",
            request.RuleName, request.CustomerId);

        var operatorName = "system";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _alertRuleService.CreateAsync(request, operatorName, ipAddress);

        return Ok(new ApiResponse<AlertRuleDto>
        {
            Code = 0,
            Message = "创建成功",
            Data = result
        });
    }

    /// <summary>
    /// 更新报警规则
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ApiResponse<AlertRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<AlertRuleDto>>> Update([FromBody] AlertRuleUpdateRequest request)
    {
        var operatorName = "system";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _alertRuleService.UpdateAsync(request, operatorName, ipAddress);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "规则不存在"
            });
        }

        return Ok(new ApiResponse<AlertRuleDto>
        {
            Code = 0,
            Message = "更新成功",
            Data = result
        });
    }

    /// <summary>
    /// 删除报警规则
    /// </summary>
    /// <param name="id">规则ID</param>
    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> Delete(long id)
    {
        var operatorName = "system";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _alertRuleService.DeleteAsync(id, operatorName, ipAddress);

        if (!result)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "规则不存在"
            });
        }

        return Ok(new ApiResponse
        {
            Code = 0,
            Message = "删除成功"
        });
    }

    /// <summary>
    /// 获取报警规则详情
    /// </summary>
    /// <param name="id">规则ID</param>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<AlertRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<AlertRuleDto>>> GetById(long id)
    {
        var result = await _alertRuleService.GetByIdAsync(id);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "规则不存在"
            });
        }

        return Ok(new ApiResponse<AlertRuleDto>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 分页查询报警规则
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AlertRuleDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<AlertRuleDto>>>> GetPaged(
        [FromQuery] AlertRuleQueryRequest request)
    {
        var result = await _alertRuleService.GetPagedAsync(request);

        return Ok(new ApiResponse<PagedResult<AlertRuleDto>>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 分页查询告警记录
    /// </summary>
    [HttpGet("alerts")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AlertDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<AlertDto>>>> GetAlerts(
        [FromQuery] AlertQueryRequest request)
    {
        var result = await _alertService.GetPagedAsync(request);

        return Ok(new ApiResponse<PagedResult<AlertDto>>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 获取告警详情
    /// </summary>
    /// <param name="alertId">告警ID</param>
    [HttpGet("alerts/{alertId}")]
    [ProducesResponseType(typeof(ApiResponse<AlertDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<AlertDto>>> GetAlertById(long alertId)
    {
        var result = await _alertService.GetByIdAsync(alertId);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "告警不存在"
            });
        }

        return Ok(new ApiResponse<AlertDto>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 确认告警
    /// </summary>
    [HttpPost("alerts/acknowledge")]
    [ProducesResponseType(typeof(ApiResponse<AlertDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<AlertDto>>> AcknowledgeAlert(
        [FromBody] AlertAcknowledgeRequest request)
    {
        var operatorName = "system";
        var result = await _alertService.AcknowledgeAsync(request, operatorName);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "告警不存在"
            });
        }

        return Ok(new ApiResponse<AlertDto>
        {
            Code = 0,
            Message = "确认成功",
            Data = result
        });
    }

    /// <summary>
    /// 处理解决告警
    /// </summary>
    [HttpPost("alerts/resolve")]
    [ProducesResponseType(typeof(ApiResponse<AlertDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<AlertDto>>> ResolveAlert(
        [FromBody] AlertResolveRequest request)
    {
        var operatorName = "system";
        var result = await _alertService.ResolveAsync(request, operatorName);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "告警不存在"
            });
        }

        return Ok(new ApiResponse<AlertDto>
        {
            Code = 0,
            Message = "处理成功",
            Data = result
        });
    }
}
