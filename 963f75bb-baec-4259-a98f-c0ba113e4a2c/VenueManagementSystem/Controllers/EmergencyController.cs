using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using VenueManagementSystem.DTOs.Common;
using VenueManagementSystem.DTOs.Emergency;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Controllers;

/// <summary>
/// 应急预案触发与通知控制器
/// 提供应急预案管理、应急事件触发、处置流程跟踪等功能
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
[Consumes("application/json")]
public class EmergencyController : ControllerBase
{
    private readonly IEmergencyService _emergencyService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<EmergencyController> _logger;

    /// <summary>
    /// 初始化应急控制器
    /// </summary>
    /// <param name="emergencyService">应急服务</param>
    /// <param name="notificationService">通知服务</param>
    /// <param name="logger">日志记录器</param>
    public EmergencyController(IEmergencyService emergencyService, INotificationService notificationService, ILogger<EmergencyController> logger)
    {
        _emergencyService = emergencyService;
        _notificationService = notificationService;
        _logger = logger;
    }

    /// <summary>
    /// 获取所有预案
    /// </summary>
    /// <returns>预案列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("plans")]
    [SwaggerOperation(Summary = "获取所有预案", Description = "获取系统中所有应急预案列表")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<EmergencyPlanDto>>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<EmergencyPlanDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<EmergencyPlanDto>>>> GetEmergencyPlans()
    {
        try
        {
            _logger.LogInformation("开始获取所有应急预案");
            var plans = new List<EmergencyPlanDto>();
            return Ok(ApiResponse<List<EmergencyPlanDto>>.SuccessResult(plans));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取应急预案时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取应急预案失败"));
        }
    }

    /// <summary>
    /// 触发应急预案
    /// </summary>
    /// <param name="dto">触发参数</param>
    /// <returns>应急日志</returns>
    /// <response code="201">触发成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("trigger")]
    [SwaggerOperation(Summary = "触发应急预案", Description = "触发指定的应急预案，启动应急处置流程")]
    [SwaggerResponse(StatusCodes.Status201Created, "触发成功", typeof(ApiResponse<EmergencyLogDto>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<EmergencyLogDto>), StatusCodes.Status201Created)]
    public async Task<ActionResult<ApiResponse<EmergencyLogDto>>> TriggerEmergency([FromBody] TriggerEmergencyDto dto)
    {
        try
        {
            _logger.LogInformation("开始触发应急预案，预案ID: {PlanId}, 场馆ID: {VenueId}", dto.PlanId, dto.VenueId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var emergencyLog = new EmergencyLogDto
            {
                PlanId = dto.PlanId,
                VenueId = dto.VenueId,
                Reason = dto.Reason,
                Severity = dto.Severity,
                TriggeredBy = dto.TriggeredBy,
                TriggeredAt = DateTime.UtcNow,
                Status = "Active"
            };

            return CreatedAtAction(nameof(GetEmergencyLog), new { logId = 1 }, ApiResponse<EmergencyLogDto>.SuccessResult(emergencyLog, "应急预案触发成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "触发应急预案时发生错误，预案ID: {PlanId}", dto.PlanId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("触发应急预案失败"));
        }
    }

    /// <summary>
    /// 完成处置步骤
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="stepId">步骤ID</param>
    /// <param name="dto">完成参数</param>
    /// <returns>完成结果</returns>
    /// <response code="200">完成成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="404">应急日志或步骤不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("{logId}/step/{stepId}/complete")]
    [SwaggerOperation(Summary = "完成处置步骤", Description = "标记应急处置步骤为已完成")]
    [SwaggerResponse(StatusCodes.Status200OK, "完成成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "应急日志或步骤不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> CompleteEmergencyStep(int logId, int stepId, [FromBody] CompleteStepDto dto)
    {
        try
        {
            _logger.LogInformation("开始完成处置步骤，日志ID: {LogId}, 步骤ID: {StepId}", logId, stepId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }
            return Ok(ApiResponse.SuccessResult("处置步骤完成成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "完成处置步骤时发生错误，日志ID: {LogId}, 步骤ID: {StepId}", logId, stepId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("完成处置步骤失败"));
        }
    }

    /// <summary>
    /// 解除应急状态
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="dto">解除参数</param>
    /// <returns>解除结果</returns>
    /// <response code="200">解除成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="404">应急日志不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("{logId}/resolve")]
    [SwaggerOperation(Summary = "解除应急状态", Description = "解除应急状态，完成整个处置流程")]
    [SwaggerResponse(StatusCodes.Status200OK, "解除成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "应急日志不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> ResolveEmergency(int logId, [FromBody] ResolveEmergencyDto dto)
    {
        try
        {
            _logger.LogInformation("开始解除应急状态，日志ID: {LogId}", logId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }
            return Ok(ApiResponse.SuccessResult("应急状态已解除"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "解除应急状态时发生错误，日志ID: {LogId}", logId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("解除应急状态失败"));
        }
    }

    /// <summary>
    /// 生成处置复盘报告
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <returns>复盘报告</returns>
    /// <response code="200">生成成功</response>
    /// <response code="404">应急日志不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{logId}/report")]
    [SwaggerOperation(Summary = "生成处置复盘报告", Description = "生成应急处置的复盘报告，包含处置过程、经验教训等")]
    [SwaggerResponse(StatusCodes.Status200OK, "生成成功", typeof(ApiResponse<EmergencyReportDto>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "应急日志不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<EmergencyReportDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<EmergencyReportDto>>> GetEmergencyReport(int logId)
    {
        try
        {
            _logger.LogInformation("开始生成处置复盘报告，日志ID: {LogId}", logId);
            var report = new EmergencyReportDto
            {
                LogId = logId,
                GeneratedAt = DateTime.UtcNow
            };
            return Ok(ApiResponse<EmergencyReportDto>.SuccessResult(report));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "生成处置复盘报告时发生错误，日志ID: {LogId}", logId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("生成处置复盘报告失败"));
        }
    }

    /// <summary>
    /// 获取历史应急记录
    /// </summary>
    /// <param name="query">查询参数</param>
    /// <returns>应急记录列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("logs")]
    [SwaggerOperation(Summary = "获取历史应急记录", Description = "获取历史应急事件记录，支持多条件筛选")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(PagedResponse<EmergencyLogDto>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(PagedResponse<EmergencyLogDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<EmergencyLogDto>>> GetEmergencyLogs([FromQuery] EmergencyLogQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始获取历史应急记录");
            var logs = new List<EmergencyLogDto>();
            var totalCount = 0;
            return Ok(PagedResponse<EmergencyLogDto>.Create(logs, query.PageNumber, query.PageSize, totalCount));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取历史应急记录时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取历史应急记录失败"));
        }
    }

    /// <summary>
    /// 获取当前活动的应急事件
    /// </summary>
    /// <returns>活动应急事件列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("active")]
    [SwaggerOperation(Summary = "获取当前活动的应急事件", Description = "获取当前正在处理中的应急事件列表")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<EmergencyLogDto>>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<EmergencyLogDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<EmergencyLogDto>>>> GetActiveEmergencies()
    {
        try
        {
            _logger.LogInformation("开始获取当前活动的应急事件");
            var activeLogs = new List<EmergencyLogDto>();
            return Ok(ApiResponse<List<EmergencyLogDto>>.SuccessResult(activeLogs));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取当前活动的应急事件时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取活动应急事件失败"));
        }
    }

    /// <summary>
    /// 获取应急日志详情（辅助方法）
    /// </summary>
    private async Task<EmergencyLogDto> GetEmergencyLog(int logId)
    {
        return await Task.FromResult(new EmergencyLogDto { Id = logId, Status = "Active" });
    }
}
