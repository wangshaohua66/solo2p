using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using WaterManagement.API.Services;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using MongoDB.Driver;

namespace WaterManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[SwaggerTag("水位雨量数据管理")]
public class WaterLevelController : ControllerBase
{
    private readonly IMongoDbContext _db;
    private readonly IDataAggregationService _aggregationService;
    private readonly IFloodSimulationService _floodSimService;

    public WaterLevelController(
        IMongoDbContext db,
        IDataAggregationService aggregationService,
        IFloodSimulationService floodSimService)
    {
        _db = db;
        _aggregationService = aggregationService;
        _floodSimService = floodSimService;
    }

    [HttpGet("stations")]
    [SwaggerOperation(Summary = "获取所有站点列表", Description = "返回所有水库和雨量站的基本信息")]
    [ProducesResponseType(typeof(ApiResponse<List<StationOverviewDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<StationOverviewDto>>>> GetStations()
    {
        var stations = await _aggregationService.GetOverviewAsync();
        return Ok(ApiResponse<List<StationOverviewDto>>.Ok(stations));
    }

    [HttpGet("stations/{id}")]
    [SwaggerOperation(Summary = "获取单个站点详情", Description = "根据站点ID获取站点实时数据")]
    [ProducesResponseType(typeof(ApiResponse<StationOverviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<StationOverviewDto>>> GetStation(string id)
    {
        var station = await _aggregationService.GetStationOverviewAsync(id);
        if (station == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "站点不存在"));
        return Ok(ApiResponse<StationOverviewDto>.Ok(station));
    }

    [HttpGet("latest")]
    [SwaggerOperation(Summary = "获取最新水位数据", Description = "返回所有站点的最新水位雨量数据")]
    [ProducesResponseType(typeof(ApiResponse<List<StationOverviewDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<StationOverviewDto>>>> GetLatest(
        [FromQuery] string? type = null)
    {
        var stations = await _aggregationService.GetOverviewAsync();
        if (!string.IsNullOrEmpty(type))
            stations = stations.Where(s => s.Type == type).ToList();
        return Ok(ApiResponse<List<StationOverviewDto>>.Ok(stations));
    }

    [HttpGet("history")]
    [SwaggerOperation(Summary = "查询历史水位数据", Description = "按站点和时间范围查询历史水位/雨量/流量数据")]
    [ProducesResponseType(typeof(ApiResponse<List<WaterLevelReadingDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<WaterLevelReadingDto>>>> GetHistory(
        [FromQuery] string stationId,
        [FromQuery] DateTime? startTime = null,
        [FromQuery] DateTime? endTime = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        if (string.IsNullOrEmpty(stationId))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "站点ID不能为空",
                new Dictionary<string, string> { ["stationId"] = "站点ID不能为空" }));

        if (pageSize > 1000)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "每页最大1000条",
                new Dictionary<string, string> { ["pageSize"] = "每页最大1000条" }));

        var filter = Builders<WaterLevelReading>.Filter.Eq(r => r.StationId, stationId);

        if (startTime.HasValue)
            filter &= Builders<WaterLevelReading>.Filter.Gte(r => r.Timestamp, startTime.Value);
        if (endTime.HasValue)
            filter &= Builders<WaterLevelReading>.Filter.Lte(r => r.Timestamp, endTime.Value);

        var total = await _db.WaterLevelReadings.CountDocumentsAsync(filter);
        var readings = await _db.WaterLevelReadings
            .Find(filter)
            .SortByDescending(r => r.Timestamp)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var dtos = readings.Select(MapToDto).OrderBy(r => r.Timestamp).ToList();
        return Ok(ApiResponse<List<WaterLevelReadingDto>>.Ok(dtos, total));
    }

    [HttpPost("flood-simulate")]
    [SwaggerOperation(Summary = "洪水演进模拟", Description = "基于当前水位流量和下游参数计算各断面水位变化")]
    [ProducesResponseType(typeof(ApiResponse<FloodSimulationResult>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<FloodSimulationResult>>> FloodSimulate(
        [FromBody] FloodSimulationParams parameters)
    {
        if (string.IsNullOrEmpty(parameters.ReservoirId))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "水库ID不能为空",
                new Dictionary<string, string> { ["reservoirId"] = "水库ID不能为空" }));

        if (parameters.SimulationHours <= 0 || parameters.SimulationHours > 168)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "模拟时长需在1-168小时之间",
                new Dictionary<string, string> { ["simulationHours"] = "模拟时长需在1-168小时之间" }));

        var result = await _floodSimService.SimulateAsync(parameters);
        return Ok(ApiResponse<FloodSimulationResult>.Ok(result));
    }

    [HttpGet("warnings")]
    [SwaggerOperation(Summary = "获取告警汇总", Description = "返回当前所有超阈值告警信息")]
    [ProducesResponseType(typeof(ApiResponse<WarningSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<WarningSummaryDto>>> GetWarnings()
    {
        var warnings = await _aggregationService.GetWarningsAsync();
        return Ok(ApiResponse<WarningSummaryDto>.Ok(warnings));
    }

    [HttpPost("readings")]
    [SwaggerOperation(Summary = "上报遥测数据", Description = "遥测站点上报水位雨量数据")]
    [ProducesResponseType(typeof(ApiResponse<WaterLevelReadingDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<WaterLevelReadingDto>>> PostReading(
        [FromBody] WaterLevelReadingDto reading)
    {
        if (string.IsNullOrEmpty(reading.StationId))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "站点ID不能为空"));

        var readingEntity = new WaterLevelReading
        {
            StationId = reading.StationId,
            StationCode = reading.StationCode,
            StationName = reading.StationName,
            StationType = reading.StationType,
            Timestamp = reading.Timestamp == default ? DateTime.UtcNow : reading.Timestamp,
            WaterLevel = reading.WaterLevel,
            Inflow = reading.Inflow,
            Outflow = reading.Outflow,
            Rainfall = reading.Rainfall,
            CumulativeRainfall = reading.CumulativeRainfall,
            Storage = reading.Storage,
            IsWarning = reading.IsWarning,
            IsDanger = reading.IsDanger,
            Source = "manual"
        };

        await _db.WaterLevelReadings.InsertOneAsync(readingEntity);
        var dto = MapToDto(readingEntity);
        return Ok(ApiResponse<WaterLevelReadingDto>.Ok(dto));
    }

    private static WaterLevelReadingDto MapToDto(WaterLevelReading r)
    {
        return new WaterLevelReadingDto
        {
            Id = r.Id,
            StationId = r.StationId,
            StationName = r.StationName,
            StationType = r.StationType,
            Timestamp = r.Timestamp,
            WaterLevel = r.WaterLevel,
            Inflow = r.Inflow,
            Outflow = r.Outflow,
            Rainfall = r.Rainfall,
            CumulativeRainfall = r.CumulativeRainfall,
            Storage = r.Storage,
            IsWarning = r.IsWarning,
            IsDanger = r.IsDanger
        };
    }
}
