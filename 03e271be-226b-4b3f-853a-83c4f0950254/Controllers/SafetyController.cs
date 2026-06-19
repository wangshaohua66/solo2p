using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Models.DTOs;
using MiningGovApi.Services;

namespace MiningGovApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SafetyController : BaseController
{
    private readonly ISafetyService _service;

    public SafetyController(ISafetyService service)
    {
        _service = service;
    }

    [HttpPost("sensor-data")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitSensorData([FromBody] SensorDataSubmitDto dto)
    {
        await _service.SubmitSensorDataAsync(dto);
        return Success("传感器数据已接收");
    }

    [HttpPost("sensor-data/batch")]
    [AllowAnonymous]
    public async Task<IActionResult> BatchSubmitSensorData([FromBody] SensorDataBatchSubmitDto dto)
    {
        var count = await _service.BatchSubmitSensorDataAsync(dto.DataList);
        return Success(new { Count = count }, $"批量接收传感器数据{count}条");
    }

    [HttpGet("alert/{id}")]
    public async Task<IActionResult> GetAlertById(int id)
    {
        var result = await _service.GetAlertByIdAsync(id);
        return Success(result);
    }

    [HttpGet("alerts/query")]
    public async Task<IActionResult> QueryAlerts([FromQuery] SafetyAlertQueryDto query)
    {
        var result = await _service.QueryAlertsAsync(query);
        return Success(result);
    }

    [HttpPost("alert/handle")]
    [Authorize(Roles = "SafetyInspector")]
    public async Task<IActionResult> HandleAlert([FromBody] SafetyAlertHandleDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.HandleAlertAsync(dto, user.Id);
        return Success(result, "预警处置已记录");
    }

    [HttpGet("thresholds/{mineId}")]
    public async Task<IActionResult> GetThresholds(int mineId)
    {
        var result = await _service.GetSensorThresholdsAsync(mineId);
        return Success(result);
    }

    [HttpPost("threshold")]
    [Authorize(Roles = "SafetyInspector,MiningApprover")]
    public async Task<IActionResult> SetThreshold([FromBody] SensorThresholdCreateDto dto)
    {
        var result = await _service.SetSensorThresholdAsync(dto);
        return Success(result, "阈值配置已保存");
    }
}
