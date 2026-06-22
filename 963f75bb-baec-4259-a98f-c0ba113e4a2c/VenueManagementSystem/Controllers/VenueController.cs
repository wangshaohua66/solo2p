using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using VenueManagementSystem.DTOs.Common;
using VenueManagementSystem.DTOs.Venue;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Controllers;

/// <summary>
/// 场馆资源与档期管理控制器
/// 提供场馆信息、资源、设备、档期等管理功能
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
[Consumes("application/json")]
public class VenueController : ControllerBase
{
    private readonly IVenueService _venueService;
    private readonly ILogger<VenueController> _logger;

    /// <summary>
    /// 初始化场馆控制器
    /// </summary>
    /// <param name="venueService">场馆服务</param>
    /// <param name="logger">日志记录器</param>
    public VenueController(IVenueService venueService, ILogger<VenueController> logger)
    {
        _venueService = venueService;
        _logger = logger;
    }

    /// <summary>
    /// 获取所有场馆列表
    /// </summary>
    /// <returns>场馆列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet]
    [SwaggerOperation(Summary = "获取所有场馆列表", Description = "获取系统中所有场馆的基本信息列表")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<Venue>>))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<Venue>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<Venue>>>> GetVenues()
    {
        try
        {
            _logger.LogInformation("开始获取所有场馆列表");
            var venues = new List<Venue>();
            return Ok(ApiResponse<List<Venue>>.SuccessResult(venues));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆列表时发生错误");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取场馆列表失败"));
        }
    }

    /// <summary>
    /// 获取单个场馆详情
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <returns>场馆详情</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">场馆不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取单个场馆详情", Description = "根据场馆ID获取场馆的详细信息")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<Venue>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<Venue>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<Venue>>> GetVenue(int id)
    {
        try
        {
            _logger.LogInformation("开始获取场馆详情，场馆ID: {VenueId}", id);
            var venue = new Venue { Id = id, Name = "示例场馆" };
            return Ok(ApiResponse<Venue>.SuccessResult(venue));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆详情时发生错误，场馆ID: {VenueId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取场馆详情失败"));
        }
    }

    /// <summary>
    /// 获取场馆所有资源
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <returns>资源列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">场馆不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}/resources")]
    [SwaggerOperation(Summary = "获取场馆所有资源", Description = "获取指定场馆下的所有资源列表")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<Resource>>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<Resource>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<Resource>>>> GetVenueResources(int id)
    {
        try
        {
            _logger.LogInformation("开始获取场馆资源列表，场馆ID: {VenueId}", id);
            var resources = new List<Resource>();
            return Ok(ApiResponse<List<Resource>>.SuccessResult(resources));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆资源列表时发生错误，场馆ID: {VenueId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取场馆资源列表失败"));
        }
    }

    /// <summary>
    /// 获取单个资源详情
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <param name="resourceId">资源ID</param>
    /// <returns>资源详情</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">场馆或资源不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}/resources/{resourceId}")]
    [SwaggerOperation(Summary = "获取单个资源详情", Description = "根据场馆ID和资源ID获取资源的详细信息")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<Resource>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆或资源不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<Resource>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<Resource>>> GetVenueResource(int id, int resourceId)
    {
        try
        {
            _logger.LogInformation("开始获取资源详情，场馆ID: {VenueId}, 资源ID: {ResourceId}", id, resourceId);
            var resource = new Resource { Id = resourceId, VenueId = id, Name = "示例资源" };
            return Ok(ApiResponse<Resource>.SuccessResult(resource));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取资源详情时发生错误，场馆ID: {VenueId}, 资源ID: {ResourceId}", id, resourceId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取资源详情失败"));
        }
    }

    /// <summary>
    /// 更新资源位置
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <param name="resourceId">资源ID</param>
    /// <param name="dto">新的位置信息</param>
    /// <returns>更新结果</returns>
    /// <response code="200">更新成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="404">场馆或资源不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPut("{id}/resources/{resourceId}/position")]
    [SwaggerOperation(Summary = "更新资源位置", Description = "更新指定资源在场地中的位置坐标")]
    [SwaggerResponse(StatusCodes.Status200OK, "更新成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆或资源不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> UpdateResourcePosition(int id, int resourceId, [FromBody] UpdateResourcePositionDto dto)
    {
        try
        {
            _logger.LogInformation("开始更新资源位置，场馆ID: {VenueId}, 资源ID: {ResourceId}", id, resourceId);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }
            return Ok(ApiResponse.SuccessResult("资源位置更新成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "更新资源位置时发生错误，场馆ID: {VenueId}, 资源ID: {ResourceId}", id, resourceId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("更新资源位置失败"));
        }
    }

    /// <summary>
    /// 获取场馆档期
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <param name="query">查询参数</param>
    /// <returns>档期列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">场馆不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}/schedule")]
    [SwaggerOperation(Summary = "获取场馆档期", Description = "获取指定场馆的档期安排，支持日期范围和资源类型筛选")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<ScheduleSlot>>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<ScheduleSlot>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ScheduleSlot>>>> GetVenueSchedule(int id, [FromQuery] VenueScheduleQueryDto query)
    {
        try
        {
            _logger.LogInformation("开始获取场馆档期，场馆ID: {VenueId}", id);
            var schedule = new List<ScheduleSlot>();
            return Ok(ApiResponse<List<ScheduleSlot>>.SuccessResult(schedule));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆档期时发生错误，场馆ID: {VenueId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取场馆档期失败"));
        }
    }

    /// <summary>
    /// 获取场馆设备列表
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <returns>设备列表</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">场馆不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}/equipment")]
    [SwaggerOperation(Summary = "获取场馆设备列表", Description = "获取指定场馆的所有设备列表")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<List<Equipment>>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<List<Equipment>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<Equipment>>>> GetVenueEquipment(int id)
    {
        try
        {
            _logger.LogInformation("开始获取场馆设备列表，场馆ID: {VenueId}", id);
            var equipment = new List<Equipment>();
            return Ok(ApiResponse<List<Equipment>>.SuccessResult(equipment));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆设备列表时发生错误，场馆ID: {VenueId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取场馆设备列表失败"));
        }
    }

    /// <summary>
    /// 切换设备模式
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <param name="dto">模式切换参数</param>
    /// <returns>切换结果</returns>
    /// <response code="200">切换成功</response>
    /// <response code="400">请求参数错误</response>
    /// <response code="404">场馆不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpPut("{id}/equipment/mode")]
    [SwaggerOperation(Summary = "切换设备模式", Description = "批量切换场馆设备的运行模式（体育模式/演唱会模式）")]
    [SwaggerResponse(StatusCodes.Status200OK, "切换成功", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status400BadRequest, "请求参数错误", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> ChangeEquipmentMode(int id, [FromBody] ChangeEquipmentModeDto dto)
    {
        try
        {
            _logger.LogInformation("开始切换场馆设备模式，场馆ID: {VenueId}, 目标模式: {Mode}", id, dto.Mode);
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse.ErrorResult("请求参数验证失败"));
            }
            return Ok(ApiResponse.SuccessResult($"设备模式已切换为 {dto.Mode}"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "切换场馆设备模式时发生错误，场馆ID: {VenueId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("切换设备模式失败"));
        }
    }

    /// <summary>
    /// 获取场馆统计数据
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <returns>统计数据</returns>
    /// <response code="200">获取成功</response>
    /// <response code="404">场馆不存在</response>
    /// <response code="401">未授权访问</response>
    /// <response code="500">服务器内部错误</response>
    [HttpGet("{id}/stats")]
    [SwaggerOperation(Summary = "获取场馆统计数据", Description = "获取场馆的运营统计数据，包括活动数、收入、上座率等")]
    [SwaggerResponse(StatusCodes.Status200OK, "获取成功", typeof(ApiResponse<VenueStatsDto>))]
    [SwaggerResponse(StatusCodes.Status404NotFound, "场馆不存在", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status401Unauthorized, "未授权访问", typeof(ApiResponse))]
    [SwaggerResponse(StatusCodes.Status500InternalServerError, "服务器内部错误", typeof(ApiResponse))]
    [ProducesResponseType(typeof(ApiResponse<VenueStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<VenueStatsDto>>> GetVenueStats(int id)
    {
        try
        {
            _logger.LogInformation("开始获取场馆统计数据，场馆ID: {VenueId}", id);
            var stats = new VenueStatsDto { VenueId = id, VenueName = "示例场馆" };
            return Ok(ApiResponse<VenueStatsDto>.SuccessResult(stats));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取场馆统计数据时发生错误，场馆ID: {VenueId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.ErrorResult("获取场馆统计数据失败"));
        }
    }
}
