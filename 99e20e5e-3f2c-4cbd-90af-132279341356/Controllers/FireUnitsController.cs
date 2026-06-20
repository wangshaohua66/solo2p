using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Unit;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class FireUnitsController : ControllerBase
{
    private readonly IFireUnitService _unitService;

    public FireUnitsController(IFireUnitService unitService)
    {
        _unitService = unitService;
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<FireUnitDto>> GetById(long id)
    {
        return await _unitService.GetByIdAsync(id);
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<FireUnitDto>>> GetPaged([FromQuery] FireUnitQueryDto query)
    {
        return await _unitService.GetPagedAsync(query);
    }

    [HttpPost]
    public async Task<ApiResponse<FireUnitDto>> Create([FromBody] FireUnitCreateDto dto)
    {
        return await _unitService.CreateAsync(dto);
    }

    [HttpPut("{id}")]
    public async Task<ApiResponse<bool>> Update(long id, [FromBody] FireUnitCreateDto dto)
    {
        return await _unitService.UpdateAsync(id, dto);
    }

    [HttpDelete("{id}")]
    public async Task<ApiResponse<bool>> Delete(long id)
    {
        return await _unitService.DeleteAsync(id);
    }

    [HttpGet("{fireUnitId}/water-system")]
    public async Task<ApiResponse<WaterSystemStatusDto>> GetWaterSystemStatus(long fireUnitId)
    {
        return await _unitService.GetWaterSystemStatusAsync(fireUnitId);
    }

    [HttpGet("water-system")]
    public async Task<ApiResponse<List<WaterSystemStatusDto>>> GetWaterSystemStatusList([FromQuery] string? districtCode)
    {
        return await _unitService.GetWaterSystemStatusListAsync(districtCode);
    }
}
