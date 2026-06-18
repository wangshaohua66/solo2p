using WaterManagement.API.DTOs;
using WaterManagement.API.Services;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace WaterManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[SwaggerTag("数据统计报表")]
public class ReportController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("level-curve")]
    [SwaggerOperation(Summary = "水位过程线", Description = "返回指定水库的水位过程线数据")]
    [ProducesResponseType(typeof(ApiResponse<List<WaterLevelPoint>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<WaterLevelPoint>>>> GetLevelCurve(
        [FromQuery] string reservoirId,
        [FromQuery] string range = "month")
    {
        if (string.IsNullOrEmpty(reservoirId))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "水库ID不能为空"));

        var data = await _reportService.GetLevelCurveAsync(reservoirId, range);
        return Ok(ApiResponse<List<WaterLevelPoint>>.Ok(data, data.Count));
    }

    [HttpGet("rainfall-isohyet")]
    [SwaggerOperation(Summary = "降雨等值线分布", Description = "返回各雨量站的累计降雨量分布")]
    [ProducesResponseType(typeof(ApiResponse<List<RainfallPoint>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<RainfallPoint>>>> GetRainfallIsohyet()
    {
        var data = await _reportService.GetRainfallIsohyetAsync();
        return Ok(ApiResponse<List<RainfallPoint>>.Ok(data, data.Count));
    }

    [HttpGet("dispatch-stats")]
    [SwaggerOperation(Summary = "调度操作统计", Description = "返回闸门操作次数统计")]
    [ProducesResponseType(typeof(ApiResponse<DispatchStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<DispatchStatsDto>>> GetDispatchStats()
    {
        var data = await _reportService.GetDispatchStatsAsync();
        return Ok(ApiResponse<DispatchStatsDto>.Ok(data));
    }

    [HttpGet("inspection-stats")]
    [SwaggerOperation(Summary = "巡检缺陷统计", Description = "返回缺陷分类占比、部位分布等统计")]
    [ProducesResponseType(typeof(ApiResponse<InspectionStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<InspectionStatsDto>>> GetInspectionStats()
    {
        var data = await _reportService.GetInspectionStatsAsync();
        return Ok(ApiResponse<InspectionStatsDto>.Ok(data));
    }
}
