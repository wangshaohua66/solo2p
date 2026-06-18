using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "EnterpriseUser")]
[SwaggerTag("运输管理 - 运输记录、轨迹追踪、异常告警")]
public class TransportController : ControllerBase
{
    private readonly ITransportService _transportService;

    public TransportController(ITransportService transportService)
    {
        _transportService = transportService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取运输记录列表", Description = "分页查询运输记录，支持按状态、企业、车牌号等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<TransportRecordDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<TransportRecordDto>>>> GetTransports([FromQuery] TransportRecordQueryDto dto)
    {
        var result = await _transportService.GetTransportsAsync(dto);
        return Ok(new ApiResponse<PagedResult<TransportRecordDto>> { Data = result });
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取运输记录详情", Description = "根据ID获取运输记录详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<TransportRecordDto>))]
    [SwaggerResponse(404, "运输记录不存在")]
    public async Task<ActionResult<ApiResponse<TransportRecordDto>>> GetTransport(int id)
    {
        var transport = await _transportService.GetTransportByIdAsync(id);
        if (transport == null)
            return NotFound(new ApiResponse<TransportRecordDto> { Code = 404, Message = "运输记录不存在" });

        return Ok(new ApiResponse<TransportRecordDto> { Data = transport });
    }

    [HttpPost]
    [SwaggerOperation(Summary = "创建运输记录", Description = "创建新的运输记录")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<TransportRecordDto>))]
    public async Task<ActionResult<ApiResponse<TransportRecordDto>>> CreateTransport([FromBody] TransportRecordCreateDto dto)
    {
        try
        {
            var result = await _transportService.CreateTransportAsync(dto);
            return Ok(new ApiResponse<TransportRecordDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<TransportRecordDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [SwaggerOperation(Summary = "更新运输记录", Description = "更新运输记录信息和状态")]
    [SwaggerResponse(200, "更新成功", typeof(ApiResponse<TransportRecordDto>))]
    [SwaggerResponse(404, "运输记录不存在")]
    public async Task<ActionResult<ApiResponse<TransportRecordDto>>> UpdateTransport(int id, [FromBody] TransportRecordUpdateDto dto)
    {
        try
        {
            var result = await _transportService.UpdateTransportAsync(id, dto);
            return Ok(new ApiResponse<TransportRecordDto> { Data = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<TransportRecordDto> { Code = 404, Message = ex.Message });
        }
    }

    [HttpGet("{id}/monitoring")]
    [SwaggerOperation(Summary = "获取运输实时监控", Description = "获取运输实时位置、速度、温度及最近轨迹点")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<TransportMonitoringDto>))]
    [SwaggerResponse(404, "运输记录不存在")]
    public async Task<ActionResult<ApiResponse<TransportMonitoringDto>>> GetTransportMonitoring(int id)
    {
        try
        {
            var result = await _transportService.GetTransportMonitoringAsync(id);
            return Ok(new ApiResponse<TransportMonitoringDto> { Data = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<TransportMonitoringDto> { Code = 404, Message = ex.Message });
        }
    }

    [HttpPost("trajectory")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "上传GPS轨迹点", Description = "车载GPS设备上报轨迹数据，每分钟一条")]
    [SwaggerResponse(200, "上传成功", typeof(ApiResponse<TransportTrajectoryDto>))]
    public async Task<ActionResult<ApiResponse<TransportTrajectoryDto>>> UploadTrajectory([FromBody] TransportTrajectoryCreateDto dto)
    {
        try
        {
            var result = await _transportService.UploadTrajectoryAsync(dto);
            return Ok(new ApiResponse<TransportTrajectoryDto> { Data = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<TransportTrajectoryDto> { Code = 404, Message = ex.Message });
        }
    }

    [HttpPost("trajectory/batch")]
    [AllowAnonymous]
    [SwaggerOperation(Summary = "批量上传GPS轨迹点", Description = "车载GPS设备批量上报轨迹数据")]
    [SwaggerResponse(200, "上传成功", typeof(ApiResponse<List<TransportTrajectoryDto>>))]
    public async Task<ActionResult<ApiResponse<List<TransportTrajectoryDto>>>> BatchUploadTrajectories([FromBody] GpsDataUploadDto dto)
    {
        var result = await _transportService.BatchUploadTrajectoriesAsync(dto);
        return Ok(new ApiResponse<List<TransportTrajectoryDto>> { Data = result });
    }

    [HttpGet("{id}/trajectories")]
    [SwaggerOperation(Summary = "获取运输轨迹", Description = "获取指定运输记录的历史轨迹点")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<List<TransportTrajectoryDto>>))]
    public async Task<ActionResult<ApiResponse<List<TransportTrajectoryDto>>>> GetTrajectories(
        int id,
        [FromQuery] int? limit = 100)
    {
        var result = await _transportService.GetTrajectoriesAsync(id, limit);
        return Ok(new ApiResponse<List<TransportTrajectoryDto>> { Data = result });
    }
}
