using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/overdue-approvals")]
[Produces("application/json")]
[Authorize]
public class OverdueApprovalController : BaseController
{
    private readonly IOverdueApprovalService _approvalService;
    private readonly ILogger<OverdueApprovalController> _logger;

    public OverdueApprovalController(IOverdueApprovalService approvalService, ILogger<OverdueApprovalController> logger)
    {
        _approvalService = approvalService;
        _logger = logger;
    }

    [HttpPost("submit")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> SubmitApproval([FromBody] SubmitOverdueApprovalRequest request)
    {
        var (operatorId, operatorName) = GetCurrentUser();
        var result = await _approvalService.SubmitApprovalAsync(request, operatorId, operatorName);
        return Success(result);
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "4")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveOverdueRequest request)
    {
        var (operatorId, operatorName) = GetCurrentUser();
        var result = await _approvalService.ApproveAsync(id, request, operatorId, operatorName);
        return Success(result);
    }

    [HttpPost("{id}/reject")]
    [Authorize(Roles = "4")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectOverdueRequest request)
    {
        var (operatorId, operatorName) = GetCurrentUser();
        var result = await _approvalService.RejectAsync(id, request, operatorId, operatorName);
        return Success(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _approvalService.GetByIdAsync(id);
        if (result == null)
            return NotFound("审批申请不存在");
        return Success(result);
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] OverdueApprovalQuery query)
    {
        var result = await _approvalService.SearchAsync(query);
        return Success(result);
    }
}
