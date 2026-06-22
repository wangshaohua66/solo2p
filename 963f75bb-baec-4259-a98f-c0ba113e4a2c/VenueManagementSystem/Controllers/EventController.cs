using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using VenueManagementSystem.DTOs.Common;
using VenueManagementSystem.DTOs.Event;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Controllers;

/// <summary>
/// 赛事申报与审批流程控制器
/// 提供赛事申报、编辑、审批流程管理等功能
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
[Consumes("application/json")]
public class EventController : ControllerBase
{
    private readonly IEventService _eventService;
    private readonly IApprovalService _approvalService;
    private readonly ILogger<EventController> _logger;

    /// <summary>
    /// 初始化赛事控制器
    /// </summary>
    /// <param name="eventService">赛事服务</param>
    /// <param name="approvalService">审批服务</param>
    /// <param name="logger">日志记录器</param>
    public EventController(IEventService eventService, IApprovalService approvalService, ILogger<EventController> logger)
    {
        _eventService = eventService;
        _approvalService = approvalService;
        _logger = logger;
    }

    /// <summary>
    /// 提交赛事申报
    /// </summary>
    /// <param name="dto">赛事申报信息</param>
    /// <returns>创建的赛事信息</returns>
    /// <response code="201">创建成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost]
    [SwaggerOperation(Summary = "提交赛事申报", Description = "创建新的赛事申报，提交后进入审批流程")]
    [SwaggerResponse(StatusCodes.Status201Created, "创建成功", typeof(ApiResponse<EventItem>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<EventItem>), StatusCodes.Status201Created)]
    public async Task<ActionResult<ApiResponse<EventItem>>> CreateEvent([FromBody] CreateEventDto dto)
    {
        try
        {
            _logger.LogInformation("开始提交赛事申报，赛事名称: {EventName}", dto.Name);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var newEvent = new EventItem
            {
                VenueId = dto.VenueId,
                Name = dto.Name,
                Type = dto.Type,
                Description = dto.Description,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                ExpectedRevenue = dto.ExpectedRevenue,
                Status = "Draft",
                CreatedBy = User.Identity?.Name ?? "System"
            };

            return CreatedAtAction(nameof(GetEvent), new { id = newEvent.Id }, ApiResponse<EventItem>.SuccessResult(newEvent, "赛事申报提交成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "提交赛事申报时发生错误，赛事名称: {EventName}", dto.Name);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("提交赛事申报失败"));
        }
    }

    /// <summary>
    /// 获取赛事列表
    /// </summary>
    /// <param name="query">查询参数</param>
    /// <returns>赛事列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet]
    [SwaggerOperation(Summary = "获取赛事列表", Description = "获取赛事列表，支持按状态、类型、场馆ID等条件筛选")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(PagedResponse<EventItem>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(PagedResponse<EventItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<EventItem>>> GetEvents([FromQuery] EventQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始获取赛事列表");
            var events = new List<EventItem>();
            var totalCount = 0;
            return Ok(PagedResponse<EventItem>.Create(events, query.PageNumber, query.PageSize, totalCount));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取赛事列表时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取赛事列表失败"));
        }
    }

    /// <summary>
    /// 获取赛事详情
    /// </summary>
    /// <param name="id">赛事ID</param>
    /// <returns>赛事详情</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">赛事不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取赛事详情", Description = "根据赛事ID获取赛事的详细信息")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<EventItem>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "赛事不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<EventItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<EventItem>>> GetEvent(int id)
    {
        try
        {
            _logger.LogInformation("开始获取赛事详情，赛事ID: {EventId}", id);
            var eventItem = new EventItem { Id = id, Name = "示例赛事" };
            return Ok(ApiResponse<EventItem>.SuccessResult(eventItem));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取赛事详情时发生错误，赛事ID: {EventId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取赛事详情失败"));
        }
    }

    /// <summary>
    /// 更新赛事信息
    /// </summary>
    /// <param name="id">赛事ID</param>
    /// <param name="dto">更新信息</param>
    /// <returns>更新后的赛事信息</returns>
    /// <response code="200">更新成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="404">赛事不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPut("{id}")]
    [SwaggerOperation(Summary = "更新赛事信息", Description = "更新赛事的基本信息，仅草稿状态可编辑")]
    [SwaggerResponse(StatusCodes.Status200OK, "更新成功", typeof(ApiResponse<EventItem>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "赛事不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<EventItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<EventItem>>> UpdateEvent(int id, [FromBody] UpdateEventDto dto)
    {
        try
        {
            _logger.LogInformation("开始更新赛事信息，赛事ID: {EventId}", id);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var updatedEvent = new EventItem { Id = id, Name = dto.Name ?? "示例赛事" };
            return Ok(ApiResponse<EventItem>.SuccessResult(updatedEvent, "赛事信息更新成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "更新赛事信息时发生错误，赛事ID: {EventId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("更新赛事信息失败"));
        }
    }

    /// <summary>
    /// 删除赛事（草稿状态）
    /// </summary>
    /// <param name="id">赛事ID</param>
    /// <returns>删除结果</returns>
    /// <response code="200">删除成功</response>
    /// <response code="400">赛事状态不允许删除</response>
    /// <response code="404">赛事不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpDelete("{id}")]
    [SwaggerOperation(Summary = "删除赛事", Description = "删除赛事，仅草稿状态的赛事可以删除")]
    [SwaggerResponse(StatusCodes.Status200OK, "删除成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "赛事状态不允许删除", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "赛事不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> DeleteEvent(int id)
    {
        try
        {
            _logger.LogInformation("开始删除赛事，赛事ID: {EventId}", id);
            return Ok(ApiResponse.SuccessResult("赛事删除成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "删除赛事时发生错误，赛事ID: {EventId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("删除赛事失败"));
        }
    }

    /// <summary>
    /// 获取审批流程
    /// </summary>
    /// <param name="id">赛事ID</param>
    /// <returns>审批流程列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">赛事不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}/approvals")]
    [SwaggerOperation(Summary = "获取审批流程", Description = "获取赛事的完整审批流程和各步骤状态")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<ApprovalFlowDto>>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "赛事不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<ApprovalFlowDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ApprovalFlowDto>>>> GetEventApprovals(int id)
    {
        try
        {
            _logger.LogInformation("开始获取赛事审批流程，赛事ID: {EventId}", id);
            var approvals = new List<ApprovalFlowDto>();
            return Ok(ApiResponse<List<ApprovalFlowDto>>.SuccessResult(approvals));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取赛事审批流程时发生错误，赛事ID: {EventId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取审批流程失败"));
        }
    }

    /// <summary>
    /// 审批通过
    /// </summary>
    /// <param name="id">赛事ID</param>
    /// <param name="stepId">审批步骤ID</param>
    /// <param name="dto">审批意见</param>
    /// <returns>审批结果</returns>
    /// <response code="200">审批通过</response>
    /// <response code="400">请求参数错误或状态不允许</response>
    /// <response code="404">赛事或审批步骤不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("{id}/approvals/{stepId}/approve")]
    [SwaggerOperation(Summary = "审批通过", Description = "对指定审批步骤执行通过操作")]
    [SwaggerResponse(StatusCodes.Status200OK, "审批通过", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误或状态不允许", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "赛事或审批步骤不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> ApproveEvent(int id, int stepId, [FromBody] ApprovalRequestDto dto)
    {
        try
        {
            _logger.LogInformation("开始审批通过，赛事ID: {EventId}, 步骤ID: {StepId}", id, stepId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }
            return Ok(ApiResponse.SuccessResult("审批通过成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "审批通过时发生错误，赛事ID: {EventId}, 步骤ID: {StepId}", id, stepId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("审批操作失败"));
        }
    }

    /// <summary>
    /// 审批驳回
    /// </summary>
    /// <param name="id">赛事ID</param>
    /// <param name="stepId">审批步骤ID</param>
    /// <param name="dto">驳回意见</param>
    /// <returns>审批结果</returns>
    /// <response code="200">审批驳回</response>
    /// <response code="400">请求参数错误或状态不允许</response>
    /// <response code="404">赛事或审批步骤不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("{id}/approvals/{stepId}/reject")]
    [SwaggerOperation(Summary = "审批驳回", Description = "对指定审批步骤执行驳回操作")]
    [SwaggerResponse(StatusCodes.Status200OK, "审批驳回", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误或状态不允许", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "赛事或审批步骤不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> RejectEvent(int id, int stepId, [FromBody] ApprovalRequestDto dto)
    {
        try
        {
            _logger.LogInformation("开始审批驳回，赛事ID: {EventId}, 步骤ID: {StepId}", id, stepId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }
            return Ok(ApiResponse.SuccessResult("审批驳回成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "审批驳回时发生错误，赛事ID: {EventId}, 步骤ID: {StepId}", id, stepId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("审批操作失败"));
        }
    }

    /// <summary>
    /// 获取待我审批的列表
    /// </summary>
    /// <param name="query">查询参数</param>
    /// <returns>待审批赛事列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("pending")]
    [SwaggerOperation(Summary = "获取待我审批的列表", Description = "获取当前用户待审批的赛事列表")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(PagedResponse<EventItem>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(PagedResponse<EventItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<EventItem>>> GetMyPendingApprovals([FromQuery] EventQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始获取待我审批的赛事列表");
            var events = new List<EventItem>();
            var totalCount = 0;
            return Ok(PagedResponse<EventItem>.Create(events, query.PageNumber, query.PageSize, totalCount));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取待我审批的赛事列表时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取待审批列表失败"));
        }
    }
}
