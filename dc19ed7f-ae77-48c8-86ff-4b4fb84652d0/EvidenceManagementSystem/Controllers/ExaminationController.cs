using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/examinations")]
[Produces("application/json")]
[Authorize]
public class ExaminationController : BaseController
{
    private readonly IExaminationService _examinationService;
    private readonly ILogger<ExaminationController> _logger;

    public ExaminationController(IExaminationService examinationService, ILogger<ExaminationController> logger)
    {
        _examinationService = examinationService;
        _logger = logger;
    }

    [HttpPost]
    [Authorize(Roles = "1,2")]
    public async Task<IActionResult> CreateTask([FromBody] CreateExaminationTaskRequest request)
    {
        var result = await _examinationService.CreateTaskAsync(request, CurrentUserId, CurrentUsername);
        return Created(result, "鉴定任务创建成功");
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _examinationService.GetByIdAsync(id);
        if (result == null)
            return NotFound("鉴定任务不存在");
        return Success(result);
    }

    [HttpGet("task-number/{taskNumber}")]
    public async Task<IActionResult> GetByTaskNumber(string taskNumber)
    {
        var result = await _examinationService.GetByTaskNumberAsync(taskNumber);
        if (result == null)
            return NotFound("鉴定任务不存在");
        return Success(result);
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] ExaminationQuery query)
    {
        var result = await _examinationService.SearchAsync(query);
        return Success(result);
    }

    [HttpPost("{id}/start")]
    [Authorize(Roles = "2")]
    public async Task<IActionResult> StartExamination(Guid id, [FromBody] StartExaminationRequest request)
    {
        var result = await _examinationService.StartExaminationAsync(id, request, CurrentUserId);
        return Success(result, "鉴定已启动");
    }

    [HttpPost("{id}/records")]
    [Authorize(Roles = "2")]
    public async Task<IActionResult> AddRecord(Guid id, [FromBody] AddExaminationRecordRequest request)
    {
        var result = await _examinationService.AddRecordAsync(id, request, CurrentUserId);
        return Created(result, "鉴定记录添加成功");
    }

    [HttpGet("{id}/records")]
    public async Task<IActionResult> GetRecords(Guid id)
    {
        var result = await _examinationService.GetRecordsByTaskIdAsync(id);
        return Success(result);
    }

    [HttpPost("{id}/submit")]
    [Authorize(Roles = "2")]
    public async Task<IActionResult> SubmitReport(Guid id, [FromBody] SubmitReportRequest request)
    {
        var result = await _examinationService.SubmitReportAsync(id, request, CurrentUserId);
        return Success(result, "报告已提交审核");
    }

    [HttpPost("{id}/review")]
    [Authorize(Roles = "3")]
    public async Task<IActionResult> ReviewReport(Guid id, [FromBody] ReviewReportRequest request)
    {
        var result = await _examinationService.ReviewReportAsync(id, request, CurrentUserId);
        return Success(result, request.IsApproved ? "审核通过" : "已驳回");
    }

    [HttpPost("{id}/issue")]
    [Authorize(Roles = "3")]
    public async Task<IActionResult> IssueReport(Guid id)
    {
        var result = await _examinationService.IssueReportAsync(id, CurrentUserId);
        return Success(result, "鉴定文书已签发");
    }
}
