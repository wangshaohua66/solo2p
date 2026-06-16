using Microsoft.AspNetCore.Mvc;
using Serilog;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class TraceabilityController : ControllerBase
{
    private readonly ITraceabilityService _traceabilityService;

    public TraceabilityController(ITraceabilityService traceabilityService)
    {
        _traceabilityService = traceabilityService;
    }

    /// <summary>
    /// 查询药品全链路溯源信息
    /// </summary>
    /// <remarks>
    /// 支持按批次号或运输单号查询，返回从入库到签收的全链路时序数据。
    /// </remarks>
    /// <param name="request">查询请求参数</param>
    /// <returns>全链路溯源信息</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<TraceabilityResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TraceabilityResponse>>> Query(
        [FromQuery] TraceabilityQueryRequest request)
    {
        Log.Information("溯源查询: BatchNumber={BatchNumber}, ShipmentId={ShipmentId}, ShipmentNumber={ShipmentNumber}",
            request.BatchNumber, request.ShipmentId, request.ShipmentNumber);

        try
        {
            var result = await _traceabilityService.GetTraceabilityAsync(request);

            return Ok(new ApiResponse<TraceabilityResponse>
            {
                Code = 0,
                Message = "查询成功",
                Data = result
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// 根据批次号查询溯源信息
    /// </summary>
    /// <param name="batchNumber">药品批次号</param>
    [HttpGet("batch/{batchNumber}")]
    [ProducesResponseType(typeof(ApiResponse<TraceabilityResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TraceabilityResponse>>> GetByBatchNumber(string batchNumber)
    {
        var request = new TraceabilityQueryRequest { BatchNumber = batchNumber };

        try
        {
            var result = await _traceabilityService.GetTraceabilityAsync(request);

            return Ok(new ApiResponse<TraceabilityResponse>
            {
                Code = 0,
                Message = "查询成功",
                Data = result
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// 根据运输单号查询溯源信息
    /// </summary>
    /// <param name="shipmentId">运输单ID</param>
    [HttpGet("shipment/{shipmentId}")]
    [ProducesResponseType(typeof(ApiResponse<TraceabilityResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TraceabilityResponse>>> GetByShipmentId(long shipmentId)
    {
        var request = new TraceabilityQueryRequest { ShipmentId = shipmentId };

        try
        {
            var result = await _traceabilityService.GetTraceabilityAsync(request);

            return Ok(new ApiResponse<TraceabilityResponse>
            {
                Code = 0,
                Message = "查询成功",
                Data = result
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// 重新构建运输批次的溯源链
    /// </summary>
    /// <param name="shipmentId">运输单ID</param>
    [HttpPost("rebuild/{shipmentId}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> RebuildTraceability(long shipmentId)
    {
        Log.Information("重新构建溯源链: ShipmentId={ShipmentId}", shipmentId);

        try
        {
            await _traceabilityService.BuildTraceabilityChainAsync(shipmentId);

            return Ok(new ApiResponse
            {
                Code = 0,
                Message = "溯源链构建成功"
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse
            {
                Code = 404,
                Message = ex.Message
            });
        }
    }
}
