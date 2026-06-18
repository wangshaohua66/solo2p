using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "EnterpriseUser")]
[SwaggerTag("演练管理 - 应急演练计划、执行、评估")]
public class DrillController : ControllerBase
{
    private readonly IEmergencyDrillService _drillService;

    public DrillController(IEmergencyDrillService drillService)
    {
        _drillService = drillService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取演练列表", Description = "分页查询演练计划，支持按状态、类型、企业等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<EmergencyDrillDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<EmergencyDrillDto>>>> GetDrills([FromQuery] EmergencyDrillQueryDto dto)
    {
        var result = await _drillService.GetDrillsAsync(dto);
        return Ok(new ApiResponse<PagedResult<EmergencyDrillDto>> { Data = result });
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取演练详情", Description = "根据ID获取演练详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<EmergencyDrillDto>))]
    [SwaggerResponse(404, "演练记录不存在")]
    public async Task<ActionResult<ApiResponse<EmergencyDrillDto>>> GetDrill(int id)
    {
        var drill = await _drillService.GetDrillByIdAsync(id);
        if (drill == null)
            return NotFound(new ApiResponse<EmergencyDrillDto> { Code = 404, Message = "演练记录不存在" });

        return Ok(new ApiResponse<EmergencyDrillDto> { Data = drill });
    }

    [HttpPost]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "创建演练计划", Description = "制定年度演练计划")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<EmergencyDrillDto>))]
    public async Task<ActionResult<ApiResponse<EmergencyDrillDto>>> CreateDrill([FromBody] EmergencyDrillCreateDto dto)
    {
        try
        {
            var result = await _drillService.CreateDrillAsync(dto);
            return Ok(new ApiResponse<EmergencyDrillDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<EmergencyDrillDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("{id}/start")]
    [SwaggerOperation(Summary = "开始演练", Description = "企业开始执行应急演练")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<EmergencyDrillDto>))]
    public async Task<ActionResult<ApiResponse<EmergencyDrillDto>>> StartDrill(int id, [FromBody] EmergencyDrillStartDto dto)
    {
        try
        {
            var result = await _drillService.StartDrillAsync(id, dto);
            return Ok(new ApiResponse<EmergencyDrillDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<EmergencyDrillDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("{id}/complete")]
    [SwaggerOperation(Summary = "完成演练", Description = "企业完成应急演练，提交执行记录")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<EmergencyDrillDto>))]
    public async Task<ActionResult<ApiResponse<EmergencyDrillDto>>> CompleteDrill(int id, [FromBody] EmergencyDrillCompleteDto dto)
    {
        try
        {
            var result = await _drillService.CompleteDrillAsync(id, dto);
            return Ok(new ApiResponse<EmergencyDrillDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<EmergencyDrillDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("{id}/evaluate")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "演练评估", Description = "监管部门对演练效果进行评估")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<EmergencyDrillDto>))]
    public async Task<ActionResult<ApiResponse<EmergencyDrillDto>>> EvaluateDrill(int id, [FromBody] EmergencyDrillEvaluateDto dto)
    {
        try
        {
            var result = await _drillService.EvaluateDrillAsync(id, dto);
            return Ok(new ApiResponse<EmergencyDrillDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<EmergencyDrillDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpGet("statistics")]
    [SwaggerOperation(Summary = "演练统计", Description = "按年度、季度、企业统计演练执行情况")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<DrillStatisticsDto>))]
    public async Task<ActionResult<ApiResponse<DrillStatisticsDto>>> GetStatistics(
        [FromQuery] int year,
        [FromQuery] int? quarter = null,
        [FromQuery] int? enterpriseId = null)
    {
        var result = await _drillService.GetStatisticsAsync(year, quarter, enterpriseId);
        return Ok(new ApiResponse<DrillStatisticsDto> { Data = result });
    }

    [HttpGet("overdue")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "获取逾期演练", Description = "获取所有逾期未执行的演练计划")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<List<DrillSupervisionDto>>))]
    public async Task<ActionResult<ApiResponse<List<DrillSupervisionDto>>>> GetOverdueDrills()
    {
        var result = await _drillService.GetOverdueDrillsAsync();
        return Ok(new ApiResponse<List<DrillSupervisionDto>> { Data = result });
    }

    [HttpPost("{id}/reminder")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "发送督办提醒", Description = "向企业发送演练督办提醒")]
    [SwaggerResponse(200, "发送成功", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> SendSupervisionReminder(int id)
    {
        try
        {
            await _drillService.SendSupervisionReminderAsync(id);
            return Ok(new ApiResponse { Message = "督办提醒发送成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse { Code = 404, Message = ex.Message });
        }
    }

    [HttpPost("check-execution")]
    [Authorize(Policy = "AdminOnly")]
    [SwaggerOperation(Summary = "检查演练执行状态", Description = "定时检查演练执行情况，对逾期演练发送督办提醒")]
    [SwaggerResponse(200, "检查完成", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> CheckDrillExecutionStatus()
    {
        await _drillService.CheckDrillExecutionStatusAsync();
        return Ok(new ApiResponse { Message = "演练执行状态检查完成" });
    }
}
