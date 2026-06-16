using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartParking.API.Common;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Controllers;

/// <summary>
/// 运营管理 API - 看板数据、工单
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class AdminController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly IWorkOrderService _workOrderService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IDashboardService dashboardService,
        IWorkOrderService workOrderService,
        ILogger<AdminController> logger)
    {
        _dashboardService = dashboardService;
        _workOrderService = workOrderService;
        _logger = logger;
    }

    /// <summary>
    /// 获取运营看板数据
    /// </summary>
    [HttpGet("dashboard/stats")]
    [Authorize(Policy = "ParkingAdmin")]
    [ProducesResponseType(typeof(ApiResponse<DashboardStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<DashboardStatsDto>>> GetDashboardStats(
        [FromQuery] string period = "day")
    {
        var result = await _dashboardService.GetStatsAsync(period);
        return Ok(result);
    }

    /// <summary>
    /// 获取工单列表
    /// </summary>
    [HttpGet("work-orders")]
    [Authorize(Policy = "ParkingAdmin")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<WorkOrderDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<WorkOrderDto>>>> GetWorkOrders(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] WorkOrderStatus? status = null,
        [FromQuery] string? assigneeId = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _workOrderService.GetWorkOrdersAsync(query, status?.ToString(), assigneeId);
        return Ok(result);
    }

    /// <summary>
    /// 创建工单（违停举报等）
    /// </summary>
    [HttpPost("work-orders")]
    [ProducesResponseType(typeof(ApiResponse<WorkOrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<WorkOrderDto>>> CreateWorkOrder(
        [FromBody] CreateWorkOrderRequest request)
    {
        var reporterId = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? throw new UnauthorizedAccessException();
        var result = await _workOrderService.CreateWorkOrderAsync(request, reporterId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 获取工单详情
    /// </summary>
    [HttpGet("work-orders/{orderId}")]
    [Authorize(Policy = "ParkingAdmin")]
    [ProducesResponseType(typeof(ApiResponse<WorkOrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<WorkOrderDto>>> GetWorkOrder(string orderId)
    {
        var result = await _workOrderService.GetByIdAsync(orderId);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }

    /// <summary>
    /// 分配工单
    /// </summary>
    [HttpPut("work-orders/{orderId}/assign")]
    [Authorize(Policy = "ParkOperator")]
    public async Task<ActionResult<ApiResponse<WorkOrderDto>>> AssignWorkOrder(
        string orderId, [FromBody] AssignWorkOrderRequest request)
    {
        var result = await _workOrderService.AssignWorkOrderAsync(orderId, request.AssigneeId);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }

    /// <summary>
    /// 更新工单状态
    /// </summary>
    [HttpPut("work-orders/{orderId}/status")]
    [Authorize(Policy = "ParkingAdmin")]
    public async Task<ActionResult<ApiResponse<WorkOrderDto>>> UpdateWorkOrderStatus(
        string orderId, [FromBody] UpdateWorkOrderStatusRequest request)
    {
        var result = await _workOrderService.UpdateStatusAsync(orderId, request.Status);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }
}
