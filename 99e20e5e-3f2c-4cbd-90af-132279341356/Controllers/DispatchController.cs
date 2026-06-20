using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Dispatch;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class DispatchController : ControllerBase
{
    private readonly IDispatchService _dispatchService;

    public DispatchController(IDispatchService dispatchService)
    {
        _dispatchService = dispatchService;
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<RescueDispatchDto>> GetById(long id)
    {
        return await _dispatchService.GetByIdAsync(id);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<RescueDispatchDto>>> GetPaged([FromQuery] DispatchQueryDto query)
    {
        return await _dispatchService.GetPagedAsync(query);
    }

    [HttpPost]
    public async Task<ApiResponse<RescueDispatchDto>> Create([FromBody] DispatchCreateDto dto)
    {
        return await _dispatchService.CreateDispatchAsync(dto);
    }

    [HttpPut("status")]
    public async Task<ApiResponse<bool>> UpdateStatus([FromBody] DispatchStatusUpdateDto dto)
    {
        return await _dispatchService.UpdateStatusAsync(dto);
    }

    [HttpPost("report")]
    public async Task<ApiResponse<bool>> SubmitReport([FromBody] DispatchReportDto dto)
    {
        return await _dispatchService.SubmitReportAsync(dto);
    }

    [HttpPut("{id}/road-condition")]
    public async Task<ApiResponse<bool>> UpdateRoadCondition(long id, [FromBody] string roadCondition)
    {
        return await _dispatchService.UpdateRoadConditionAsync(id, roadCondition);
    }

    [HttpPut("{id}/live-video")]
    public async Task<ApiResponse<bool>> UpdateLiveVideo(long id, [FromBody] string liveVideoUrl)
    {
        return await _dispatchService.UpdateLiveVideoAsync(id, liveVideoUrl);
    }

    [HttpGet("nearby")]
    public async Task<ApiResponse<List<NearbyStationDto>>> FindNearbyStations([FromQuery] decimal latitude,
        [FromQuery] decimal longitude, [FromQuery] int count = 3)
    {
        return await _dispatchService.FindNearbyStationsAsync(latitude, longitude, count);
    }

    [HttpGet("stations")]
    public async Task<ApiResponse<List<FireStationDto>>> GetAllStations()
    {
        return await _dispatchService.GetAllStationsAsync();
    }

    [HttpGet("stations/{id}")]
    public async Task<ApiResponse<FireStationDto>> GetStationById(long id)
    {
        return await _dispatchService.GetStationByIdAsync(id);
    }

    [HttpGet("stations/{stationId}/firefighters")]
    public async Task<ApiResponse<List<FirefighterDto>>> GetFirefightersByStation(long stationId)
    {
        return await _dispatchService.GetFirefightersByStationAsync(stationId);
    }

    [HttpPost("stations")]
    public async Task<ApiResponse<FireStationDto>> CreateStation([FromBody] FireStationDto dto)
    {
        return await _dispatchService.CreateStationAsync(dto);
    }

    [HttpPut("stations/{id}")]
    public async Task<ApiResponse<bool>> UpdateStation(long id, [FromBody] FireStationDto dto)
    {
        return await _dispatchService.UpdateStationAsync(id, dto);
    }

    [HttpPost("firefighters")]
    public async Task<ApiResponse<FirefighterDto>> CreateFirefighter([FromBody] FirefighterDto dto)
    {
        return await _dispatchService.CreateFirefighterAsync(dto);
    }
}
