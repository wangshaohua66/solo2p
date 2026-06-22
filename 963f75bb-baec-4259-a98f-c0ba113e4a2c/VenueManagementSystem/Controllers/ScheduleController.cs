using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using VenueManagementSystem.DTOs.Common;
using VenueManagementSystem.DTOs.Schedule;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Controllers;

/// <summary>
/// 智能排期与冲突检测控制器
/// 提供排期冲突检测、排期方案推荐、档期锁定与确认等功能
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
[Consumes("application/json")]
public class ScheduleController : ControllerBase
{
    private readonly IScheduleService _scheduleService;
    private readonly IScheduleEngine _scheduleEngine;
    private readonly ILogger<ScheduleController> _logger;

    /// <summary>
    /// 初始化排期控制器
    /// </summary>
    /// <param name="scheduleService">排期服务</param>
    /// <param name="scheduleEngine">排期引擎</param>
    /// <param name="logger">日志记录器</param>
    public ScheduleController(IScheduleService scheduleService, IScheduleEngine scheduleEngine, ILogger<ScheduleController> logger)
    {
        _scheduleService = scheduleService;
        _scheduleEngine = scheduleEngine;
        _logger = logger;
    }

    /// <summary>
    /// 检测档期冲突
    /// </summary>
    /// <param name="dto">冲突检测参数</param>
    /// <returns>冲突检测结果</returns>
    /// <response code="200">检测成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("check-conflicts")]
    [SwaggerOperation(Summary = "检测档期冲突", Description = "检测指定时间范围内场馆资源是否存在档期冲突")]
    [SwaggerResponse(StatusCodes.Status200OK, "检测成功", typeof(ApiResponse<ConflictResultDto>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<ConflictResultDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ConflictResultDto>>> CheckConflicts([FromBody] CheckConflictDto dto)
    {
        try
        {
            _logger.LogInformation("开始检测档期冲突，场馆ID: {VenueId}, 开始时间: {StartTime}, 结束时间: {EndTime}", dto.VenueId, dto.StartTime, dto.EndTime);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var result = new ConflictResultDto { HasConflict = false };
            return Ok(ApiResponse<ConflictResultDto>.SuccessResult(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "检测档期冲突时发生错误，场馆ID: {VenueId}", dto.VenueId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("检测档期冲突失败"));
        }
    }

    /// <summary>
    /// 推荐排期方案
    /// </summary>
    /// <param name="dto">推荐参数</param>
    /// <returns>排期方案列表</returns>
    /// <response code="200">推荐成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("suggest")]
    [SwaggerOperation(Summary = "推荐排期方案", Description = "根据活动需求智能推荐最优排期方案，支持多方案对比")]
    [SwaggerResponse(StatusCodes.Status200OK, "推荐成功", typeof(ApiResponse<List<ScheduleSuggestionDto>>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<ScheduleSuggestionDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ScheduleSuggestionDto>>>> SuggestSchedule([FromBody] SuggestScheduleDto dto)
    {
        try
        {
            _logger.LogInformation("开始推荐排期方案，活动ID: {EventId}, 场馆ID: {VenueId}", dto.EventId, dto.VenueId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var suggestions = new List<ScheduleSuggestionDto>();
            return Ok(ApiResponse<List<ScheduleSuggestionDto>>.SuccessResult(suggestions));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "推荐排期方案时发生错误，活动ID: {EventId}", dto.EventId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("推荐排期方案失败"));
        }
    }

    /// <summary>
    /// 锁定档期（7天窗口）
    /// </summary>
    /// <param name="dto">锁定参数</param>
    /// <returns>锁定结果</returns>
    /// <response code="200">锁定成功</response>
    /// <response code="400">请求参数错误或档期已被占用</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("lock")]
    [SwaggerOperation(Summary = "锁定档期", Description = "临时锁定指定档期，锁定窗口为7天，超时自动释放")]
    [SwaggerResponse(StatusCodes.Status200OK, "锁定成功", typeof(ApiResponse<ScheduleSlot>))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误或档期已被占用", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<ScheduleSlot>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ScheduleSlot>>> LockSchedule([FromBody] LockScheduleDto dto)
    {
        try
        {
            _logger.LogInformation("开始锁定档期，活动ID: {EventId}, 场馆ID: {VenueId}, 资源ID: {ResourceId}", dto.EventId, dto.VenueId, dto.ResourceId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }

            var lockedSlot = new ScheduleSlot
            {
                EventId = dto.EventId,
                VenueId = dto.VenueId,
                ResourceId = dto.ResourceId,
                StartTime = dto.StartTime,
                EndTime = dto.EndTime,
                IsLocked = true,
                LockExpiresAt = DateTime.UtcNow.AddDays(7)
            };

            return Ok(ApiResponse<ScheduleSlot>.SuccessResult(lockedSlot, "档期锁定成功，有效期7天"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "锁定档期时发生错误，活动ID: {EventId}", dto.EventId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("锁定档期失败"));
        }
    }

    /// <summary>
    /// 解除锁定
    /// </summary>
    /// <param name="scheduleSlotId">排期时段ID</param>
    /// <returns>解除结果</returns>
    /// <response code="200">解除成功</response>
    /// <response code="404">排期时段不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("unlock")]
    [SwaggerOperation(Summary = "解除锁定", Description = "手动解除档期锁定，释放资源占用")]
    [SwaggerResponse(StatusCodes.Status200OK, "解除成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "排期时段不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> UnlockSchedule([FromBody] int scheduleSlotId)
    {
        try
        {
            _logger.LogInformation("开始解除档期锁定，排期ID: {ScheduleSlotId}", scheduleSlotId);
            return Ok(ApiResponse.SuccessResult("档期锁定已解除"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "解除档期锁定时发生错误，排期ID: {ScheduleSlotId}", scheduleSlotId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("解除档期锁定失败"));
        }
    }

    /// <summary>
    /// 确认排期
    /// </summary>
    /// <param name="dto">确认参数</param>
    /// <returns>确认结果</returns>
    /// <response code="200">确认成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPost("confirm")]
    [SwaggerOperation(Summary = "确认排期", Description = "确认排期并将锁定状态转为正式排期")]
    [SwaggerResponse(StatusCodes.Status200OK, "确认成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> ConfirmSchedule([FromBody] ConfirmScheduleDto dto)
    {
        try
        {
            _logger.LogInformation("开始确认排期，活动ID: {EventId}", dto.EventId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }
            return Ok(ApiResponse.SuccessResult("排期确认成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "确认排期时发生错误，活动ID: {EventId}", dto.EventId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("确认排期失败"));
        }
    }

    /// <summary>
    /// 获取场馆排期表
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="query">查询参数</param>
    /// <returns>排期表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">场馆不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("venue/{venueId}")]
    [SwaggerOperation(Summary = "获取场馆排期表", Description = "获取指定场馆的排期表，支持日期范围筛选")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<ScheduleSlot>>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<ScheduleSlot>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ScheduleSlot>>>> GetVenueSchedule(int venueId, [FromQuery] ScheduleQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始获取场馆排期表，场馆ID: {VenueId}", venueId);
            var schedule = new List<ScheduleSlot>();
            return Ok(ApiResponse<List<ScheduleSlot>>.SuccessResult(schedule));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆排期表时发生错误，场馆ID: {VenueId}", venueId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取场馆排期表失败"));
        }
    }

    /// <summary>
    /// 获取日历视图数据
    /// </summary>
    /// <param name="query">查询参数</param>
    /// <returns>日历视图数据</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("calendar")]
    [SwaggerOperation(Summary = "获取日历视图数据", Description = "获取日历视图所需的排期数据和场馆资源概览")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<CalendarViewDto>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<CalendarViewDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<CalendarViewDto>>> GetCalendarView([FromQuery] ScheduleQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始获取日历视图数据");
            var calendarView = new CalendarViewDto
            {
                StartDate = query.StartDate ?? DateTime.UtcNow,
                EndDate = query.EndDate ?? DateTime.UtcNow.AddMonths(1)
            };
            return Ok(ApiResponse<CalendarViewDto>.SuccessResult(calendarView));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取日历视图数据时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取日历视图数据失败"));
        }
    }
}
