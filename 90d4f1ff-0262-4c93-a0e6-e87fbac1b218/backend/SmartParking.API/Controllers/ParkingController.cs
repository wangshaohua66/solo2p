using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartParking.API.Common;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Controllers;

/// <summary>
/// 停车管理 API - 车位、停车场、出入场
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class ParkingController : ControllerBase
{
    private readonly IParkingService _service;
    private readonly ILogger<ParkingController> _logger;

    public ParkingController(IParkingService service, ILogger<ParkingController> logger)
    {
        _service = service;
        _logger = logger;
    }

    /// <summary>
    /// 获取所有停车场及车位数据
    /// </summary>
    [HttpGet("lots")]
    [ProducesResponseType(typeof(ApiResponse<List<ParkingLotDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ParkingLotDto>>>> GetLots()
    {
        var result = await _service.GetAllLotsAsync();
        return Ok(result);
    }

    /// <summary>
    /// 获取单个停车场详情
    /// </summary>
    [HttpGet("lots/{lotId}")]
    [ProducesResponseType(typeof(ApiResponse<ParkingLotDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ParkingLotDto>>> GetLot(string lotId)
    {
        var result = await _service.GetLotByIdAsync(lotId);
        if (result.Code == 404) return NotFound(result);
        return Ok(result);
    }

    /// <summary>
    /// 车辆入场
    /// </summary>
    [HttpPost("entry")]
    [Authorize(Policy = "ParkingAdmin")]
    [ProducesResponseType(typeof(ApiResponse<ParkingRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ParkingRecordDto>>> Entry([FromBody] ParkingEntryRequest request)
    {
        var userId = User.FindFirstValue("UserId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        var result = await _service.EntryParkingAsync(request, userId);
        if (result.Code != 200) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>
    /// 车辆出场结算
    /// </summary>
    [HttpPost("exit")]
    [Authorize(Policy = "ParkingAdmin")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> Exit([FromBody] ParkingExitRequest request)
    {
        var result = await _service.ExitParkingAsync(request);
        if (result.Code != 200) return BadRequest(result);
        return Ok(ApiResponse<object>.Success(new
        {
            Record = result.Data.Record,
            Fee = result.Data.Fee
        }));
    }

    /// <summary>
    /// 获取停车记录
    /// </summary>
    [HttpGet("records")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ParkingRecordDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<ParkingRecordDto>>>> GetRecords(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] string? status = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] SortDirection sortDirection = SortDirection.Descending)
    {
        var query = new PagedQuery
        {
            PageIndex = pageIndex,
            PageSize = pageSize,
            Keyword = keyword,
            SortBy = sortBy,
            SortDirection = sortDirection
        };
        var result = await _service.GetRecordsAsync(query, status);
        return Ok(result);
    }
}
