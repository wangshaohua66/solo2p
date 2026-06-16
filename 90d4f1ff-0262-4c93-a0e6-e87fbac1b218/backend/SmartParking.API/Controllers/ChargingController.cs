using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartParking.API.Common;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Controllers;

/// <summary>
/// 充电桩管理 API - 充电桩、预约、充电会话
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class ChargingController : ControllerBase
{
    private readonly IChargingService _service;
    private readonly ILogger<ChargingController> _logger;

    public ChargingController(IChargingService service, ILogger<ChargingController> logger)
    {
        _service = service;
        _logger = logger;
    }

    /// <summary>
    /// 获取充电桩列表
    /// </summary>
    [HttpGet("stations")]
    [ProducesResponseType(typeof(ApiResponse<List<ChargingStationDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ChargingStationDto>>>> GetStations(
        [FromQuery] string? parkingLotId = null,
        [FromQuery] string? status = null)
    {
        var result = await _service.GetStationsAsync(parkingLotId, status);
        return Ok(result);
    }

    /// <summary>
    /// 获取充电桩详情
    /// </summary>
    [HttpGet("stations/{stationId}")]
    [ProducesResponseType(typeof(ApiResponse<ChargingStationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ChargingStationDto>>> GetStation(string stationId)
    {
        var result = await _service.GetStationByIdAsync(stationId);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }

    /// <summary>
    /// 获取充电桩空闲时段
    /// </summary>
    [HttpGet("stations/{stationId}/available-slots")]
    [ProducesResponseType(typeof(ApiResponse<List<AvailableSlotDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<AvailableSlotDto>>>> GetAvailableSlots(
        string stationId,
        [FromQuery] string date)
    {
        var result = await _service.GetAvailableSlotsAsync(stationId, date);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 创建充电桩预约
    /// </summary>
    [HttpPost("reservations")]
    [ProducesResponseType(typeof(ApiResponse<ChargingReservationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ChargingReservationDto>>> CreateReservation(
        [FromBody] CreateReservationRequest request)
    {
        var userId = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? throw new UnauthorizedAccessException();
        var result = await _service.CreateReservationAsync(request, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 取消预约
    /// </summary>
    [HttpDelete("reservations/{reservationId}")]
    public async Task<ActionResult<ApiResponse>> CancelReservation(string reservationId)
    {
        var userId = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? throw new UnauthorizedAccessException();
        var result = await _service.CancelReservationAsync(reservationId, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 获取预约记录
    /// </summary>
    [HttpGet("reservations")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ChargingReservationDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<ChargingReservationDto>>>> GetReservations(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] string? status = null)
    {
        var userId = User.IsInRole("CarOwner")
            ? User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;

        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _service.GetReservationsAsync(query, status, userId);
        return Ok(result);
    }

    /// <summary>
    /// 开始充电
    /// </summary>
    [HttpPost("stations/{stationId}/start")]
    [ProducesResponseType(typeof(ApiResponse<ChargingSessionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ChargingSessionDto>>> StartCharging(string stationId)
    {
        var userId = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? throw new UnauthorizedAccessException();
        var result = await _service.StartChargingAsync(stationId, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 结束充电
    /// </summary>
    [HttpPut("sessions/{sessionId}/stop")]
    [ProducesResponseType(typeof(ApiResponse<ChargingSessionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ChargingSessionDto>>> StopCharging(string sessionId)
    {
        var userId = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? throw new UnauthorizedAccessException();
        var result = await _service.StopChargingAsync(sessionId, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 获取充电会话记录
    /// </summary>
    [HttpGet("sessions")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ChargingSessionDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<ChargingSessionDto>>>> GetSessions(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null)
    {
        var userId = User.IsInRole("CarOwner")
            ? User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;

        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize };
        var result = await _service.GetSessionsAsync(query, status, userId);
        return Ok(result);
    }
}
