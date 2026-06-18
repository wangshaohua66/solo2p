using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "EnterpriseUser")]
[SwaggerTag("隐患管理 - 隐患排查、整改闭环、升级督办")]
public class HazardController : ControllerBase
{
    private readonly IHazardRectificationService _hazardService;

    public HazardController(IHazardRectificationService hazardService)
    {
        _hazardService = hazardService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取隐患列表", Description = "分页查询隐患整改记录，支持按状态、等级、企业等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<HazardRectificationDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<HazardRectificationDto>>>> GetHazards([FromQuery] HazardRectificationQueryDto dto)
    {
        var result = await _hazardService.GetHazardsAsync(dto);
        return Ok(new ApiResponse<PagedResult<HazardRectificationDto>> { Data = result });
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取隐患详情", Description = "根据ID获取隐患详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<HazardRectificationDto>))]
    [SwaggerResponse(404, "隐患记录不存在")]
    public async Task<ActionResult<ApiResponse<HazardRectificationDto>>> GetHazard(int id)
    {
        var hazard = await _hazardService.GetHazardByIdAsync(id);
        if (hazard == null)
            return NotFound(new ApiResponse<HazardRectificationDto> { Code = 404, Message = "隐患记录不存在" });

        return Ok(new ApiResponse<HazardRectificationDto> { Data = hazard });
    }

    [HttpPost]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "创建隐患记录", Description = "检查发现问题后生成整改工单")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<HazardRectificationDto>))]
    public async Task<ActionResult<ApiResponse<HazardRectificationDto>>> CreateHazard([FromBody] HazardRectificationCreateDto dto)
    {
        try
        {
            var result = await _hazardService.CreateHazardAsync(dto);
            return Ok(new ApiResponse<HazardRectificationDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<HazardRectificationDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("{id}/start")]
    [SwaggerOperation(Summary = "开始整改", Description = "企业开始进行隐患整改")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<HazardRectificationDto>))]
    public async Task<ActionResult<ApiResponse<HazardRectificationDto>>> StartRectification(int id, [FromBody] HazardRectificationStartDto dto)
    {
        try
        {
            var result = await _hazardService.StartRectificationAsync(id, dto);
            return Ok(new ApiResponse<HazardRectificationDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<HazardRectificationDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("{id}/complete")]
    [SwaggerOperation(Summary = "完成整改", Description = "企业完成隐患整改，申请验收")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<HazardRectificationDto>))]
    public async Task<ActionResult<ApiResponse<HazardRectificationDto>>> CompleteRectification(int id, [FromBody] HazardRectificationCompleteDto dto)
    {
        try
        {
            var result = await _hazardService.CompleteRectificationAsync(id, dto);
            return Ok(new ApiResponse<HazardRectificationDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<HazardRectificationDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("{id}/inspect")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "整改验收", Description = "监管部门对整改结果进行验收")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<HazardRectificationDto>))]
    public async Task<ActionResult<ApiResponse<HazardRectificationDto>>> InspectRectification(int id, [FromBody] HazardRectificationInspectionDto dto)
    {
        try
        {
            var result = await _hazardService.InspectRectificationAsync(id, dto);
            return Ok(new ApiResponse<HazardRectificationDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<HazardRectificationDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("{id}/escalate")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "隐患升级", Description = "逾期未整改的隐患自动或手动升级")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<HazardRectificationDto>))]
    public async Task<ActionResult<ApiResponse<HazardRectificationDto>>> EscalateHazard(int id, [FromBody] string reason)
    {
        try
        {
            var result = await _hazardService.EscalateHazardAsync(id, reason);
            return Ok(new ApiResponse<HazardRectificationDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<HazardRectificationDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpGet("statistics")]
    [SwaggerOperation(Summary = "隐患统计", Description = "按企业、时间统计隐患整改情况")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<HazardStatisticsDto>))]
    public async Task<ActionResult<ApiResponse<HazardStatisticsDto>>> GetStatistics(
        [FromQuery] int? enterpriseId = null,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var result = await _hazardService.GetStatisticsAsync(enterpriseId, year, month);
        return Ok(new ApiResponse<HazardStatisticsDto> { Data = result });
    }

    [HttpPost("check-overdue")]
    [Authorize(Policy = "AdminOnly")]
    [SwaggerOperation(Summary = "检查逾期隐患", Description = "定时检查逾期未整改隐患，触发自动升级")]
    [SwaggerResponse(200, "检查完成", typeof(ApiResponse))]
    public async Task<ActionResult<ApiResponse>> CheckOverdueHazards()
    {
        await _hazardService.CheckOverdueHazardsAsync();
        return Ok(new ApiResponse { Message = "逾期隐患检查完成" });
    }
}
