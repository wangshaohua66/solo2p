using Microsoft.AspNetCore.Mvc;
using Serilog;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class SensorDataController : ControllerBase
{
    private readonly ISensorDataService _sensorDataService;

    public SensorDataController(ISensorDataService sensorDataService)
    {
        _sensorDataService = sensorDataService;
    }

    /// <summary>
    /// 批量接收传感器数据上报
    /// </summary>
    /// <remarks>
    /// 支持单次接收单车辆全部传感器的批量上报，校验设备编号归属、时间戳合理性、数值范围合法性。
    /// </remarks>
    /// <param name="request">批量上报数据请求</param>
    /// <returns>上报处理结果</returns>
    [HttpPost("batch")]
    [ProducesResponseType(typeof(ApiResponse<SensorDataBatchResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<SensorDataBatchResponse>>> ReceiveBatch([FromBody] SensorDataBatchRequest request)
    {
        Log.Debug("接收传感器数据上报: VehicleNumber={VehicleNumber}, Count={Count}",
            request.VehicleNumber, request.Data?.Count ?? 0);

        var result = await _sensorDataService.ReceiveBatchAsync(request);

        Log.Debug("传感器数据上报处理完成: 成功={SuccessCount}, 失败={FailedCount}, 告警={AlertCount}",
            result.SuccessCount, result.FailedCount, result.AlertCount);

        return Ok(new ApiResponse<SensorDataBatchResponse>
        {
            Code = 0,
            Message = "上报成功",
            Data = result
        });
    }

    /// <summary>
    /// 分页查询传感器数据
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<SensorDataDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PagedResult<SensorDataDto>>>> GetPaged(
        [FromQuery] SensorDataQueryRequest request)
    {
        var result = await _sensorDataService.GetPagedAsync(request);

        return Ok(new ApiResponse<PagedResult<SensorDataDto>>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 获取指定传感器的滑动窗口统计指标
    /// </summary>
    /// <param name="sensorId">传感器ID</param>
    /// <param name="windowMinutes">窗口大小（分钟）</param>
    [HttpGet("stats/{sensorId}")]
    [ProducesResponseType(typeof(ApiResponse<SlidingWindowStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<SlidingWindowStatsDto>>> GetSlidingWindowStats(
        long sensorId,
        [FromQuery] int windowMinutes = 5)
    {
        var result = await _sensorDataService.GetSlidingWindowStatsAsync(sensorId, windowMinutes);

        if (result == null)
        {
            return Ok(new ApiResponse<SlidingWindowStatsDto>
            {
                Code = 1001,
                Message = "暂无统计数据",
                Data = null
            });
        }

        return Ok(new ApiResponse<SlidingWindowStatsDto>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }

    /// <summary>
    /// 获取指定运输单的传感器数据
    /// </summary>
    /// <param name="shipmentId">运输单ID</param>
    /// <param name="startTime">开始时间</param>
    /// <param name="endTime">结束时间</param>
    [HttpGet("shipment/{shipmentId}")]
    [ProducesResponseType(typeof(ApiResponse<List<SensorDataDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<SensorDataDto>>>> GetByShipmentId(
        long shipmentId,
        [FromQuery] DateTime? startTime,
        [FromQuery] DateTime? endTime)
    {
        var start = startTime ?? DateTime.UtcNow.AddDays(-7);
        var end = endTime ?? DateTime.UtcNow;

        var result = await _sensorDataService.GetByShipmentIdAsync(shipmentId, start, end);

        return Ok(new ApiResponse<List<SensorDataDto>>
        {
            Code = 0,
            Message = "查询成功",
            Data = result
        });
    }
}
