using Microsoft.AspNetCore.Mvc;
using Serilog;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ShipmentController : ControllerBase
{
    private readonly IShipmentService _shipmentService;

    public ShipmentController(IShipmentService shipmentService)
    {
        _shipmentService = shipmentService;
    }

    /// <summary>
    /// 创建运输批次
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ShipmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<ShipmentDto>>> Create([FromBody] ShipmentCreateRequest request)
    {
        Log.Information("创建运输批次: CustomerId={CustomerId}, VehicleId={VehicleId}",
            request.CustomerId, request.VehicleId);

        var result = await _shipmentService.CreateAsync(request);

        return Ok(new ApiResponse<ShipmentDto>
        {
            Code = 0,
            Message = "创建成功",
            Data = result
        });
    }

    /// <summary>
    /// 更新运输批次信息
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(ApiResponse<ShipmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<ShipmentDto>>> Update([FromBody] ShipmentUpdateRequest request)
    {
        var result = await _shipmentService.UpdateAsync(request);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "运输单不存在"
            });
        }

        return Ok(new ApiResponse<ShipmentDto>
        {
            Code = 0,
            Message = "更新成功",
            Data = result
        });
    }

    /// <summary>
    /// 更新运输状态
    /// </summary>
    [HttpPost("status")]
    [ProducesResponseType(typeof(ApiResponse<ShipmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<ShipmentDto>>> UpdateStatus([FromBody] ShipmentStatusUpdateRequest request)
    {
        var result = await _shipmentService.UpdateStatusAsync(request);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "运输单不存在"
            });
        }

        return Ok(new ApiResponse<ShipmentDto>
        {
            Code = 0,
            Message = "状态更新成功",
            Data = result
        });
    }

    /// <summary>
    /// 获取运输批次详情
    /// </summary>
    /// <param name="id">运输单ID</param>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ShipmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<ShipmentDto>>> GetById(long id)
    {
        var result = await _shipmentService.GetByIdAsync(id);

        if (result == null)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = "运输单不存在"
            });
        }

        return Ok(new ApiResponse<ShipmentDto>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 分页查询运输批次
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ShipmentDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<ShipmentDto>>>> GetPaged(
        [FromQuery] ShipmentQueryRequest request)
    {
        var result = await _shipmentService.GetPagedAsync(request);

        return Ok(new ApiResponse<PagedResult<ShipmentDto>>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }
}
