using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Services;

namespace SpecialEquipmentInspection.Controllers;

[ApiController]
[Authorize]
[Route("api/inspections")]
public class InspectionController : ControllerBase
{
    private readonly IInspectionService _service;
    private readonly ICurrentUserAccessor _user;

    public InspectionController(IInspectionService service, ICurrentUserAccessor user)
    {
        _service = service;
        _user = user;
    }

    [HttpGet("plans")]
    public async Task<ApiResponse<PagedResult<InspectionPlan>>> GetPlans(
        [FromQuery] int? year, [FromQuery] string? region, [FromQuery] PlanStatus? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _service.GetPlansAsync(year, region, status, page, pageSize);
        return ApiResponse<PagedResult<InspectionPlan>>.Ok(result);
    }

    [HttpGet("plans/{id:int}")]
    public async Task<ApiResponse<InspectionPlan>> GetPlan(int id)
    {
        var plan = await _service.GetPlanAsync(id) ?? throw new NotFoundException("检验计划不存在");
        return ApiResponse<InspectionPlan>.Ok(plan);
    }

    [HttpPost("plans")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<InspectionPlan>> CreatePlan([FromBody] CreatePlanDto dto)
    {
        var plan = await _service.CreatePlanAsync(dto, _user.User);
        return ApiResponse<InspectionPlan>.Ok(plan, "检验计划生成成功");
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<Inspection>> CreateInspection([FromBody] CreateInspectionDto dto)
    {
        var ins = await _service.CreateInspectionAsync(dto, _user.User);
        return ApiResponse<Inspection>.Ok(ins, "检验工单创建成功");
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<Inspection>>> GetInspections(
        [FromQuery] int? deviceId, [FromQuery] int? inspectorId,
        [FromQuery] InspectionStatus? status, [FromQuery] InspectionResult? result,
        [FromQuery] int? planId, [FromQuery] DateTime? dateFrom, [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var data = await _service.GetInspectionsAsync(deviceId, inspectorId, status, result, planId, dateFrom, dateTo, page, pageSize, _user.User);
        return ApiResponse<PagedResult<Inspection>>.Ok(data);
    }

    [HttpGet("{id:int}")]
    public async Task<ApiResponse<Inspection>> GetInspection(int id)
    {
        var ins = await _service.GetInspectionAsync(id, _user.User);
        return ApiResponse<Inspection>.Ok(ins!);
    }

    [HttpPost("{id:int}/start")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<Inspection>> Start(int id)
    {
        var ins = await _service.StartInspectionAsync(id, _user.User);
        return ApiResponse<Inspection>.Ok(ins, "检验已开始执行");
    }

    [HttpPost("{id:int}/submit")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<Inspection>> Submit(int id, [FromBody] SubmitInspectionDto dto)
    {
        var ins = await _service.SubmitInspectionAsync(id, dto, _user.User);
        return ApiResponse<Inspection>.Ok(ins, "检验记录提交成功");
    }

    [HttpGet("rectifications")]
    public async Task<ApiResponse<PagedResult<Rectification>>> GetRectifications(
        [FromQuery] int? inspectionId, [FromQuery] int? deviceId,
        [FromQuery] RectificationStatus? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var data = await _service.GetRectificationsAsync(inspectionId, deviceId, status, page, pageSize, _user.User);
        return ApiResponse<PagedResult<Rectification>>.Ok(data);
    }

    [HttpPost("rectifications")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<Rectification>> CreateRectification([FromBody] RectificationCreateDto dto)
    {
        var rect = await _service.CreateRectificationAsync(dto, _user.User);
        return ApiResponse<Rectification>.Ok(rect, "整改通知单已生成");
    }

    [HttpPost("rectifications/{id:int}/feedback")]
    [Authorize(Roles = "UserUnit,Admin")]
    public async Task<ApiResponse<Rectification>> SubmitFeedback(int id, [FromBody] RectificationFeedbackDto dto)
    {
        var rect = await _service.SubmitRectificationFeedbackAsync(id, dto, _user.User);
        return ApiResponse<Rectification>.Ok(rect, "整改反馈提交成功");
    }

    [HttpPost("rectifications/{id:int}/reinspection")]
    [Authorize(Roles = "Inspector,Admin")]
    public async Task<ApiResponse<Rectification>> Reinspection(int id, [FromBody] ReinspectionDto dto)
    {
        var rect = await _service.ConfirmReinspectionAsync(id, dto, _user.User);
        return ApiResponse<Rectification>.Ok(rect, "复检确认完成");
    }
}
