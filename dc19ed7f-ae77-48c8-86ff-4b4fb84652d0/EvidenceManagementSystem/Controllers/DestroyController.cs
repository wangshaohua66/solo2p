using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/destroy")]
[Produces("application/json")]
[Authorize]
public class DestroyController : BaseController
{
    private readonly IDestroyService _destroyService;
    private readonly ILogger<DestroyController> _logger;

    public DestroyController(IDestroyService destroyService, ILogger<DestroyController> logger)
    {
        _destroyService = destroyService;
        _logger = logger;
    }

    [HttpPost]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateDestroyRequestRequest request)
    {
        var result = await _destroyService.CreateRequestAsync(request, CurrentUserId, CurrentUsername);
        return Created(result, "销毁申请已提交");
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _destroyService.GetByIdAsync(id);
        if (result == null)
            return NotFound("销毁申请不存在");
        return Success(result);
    }

    [HttpGet("request-number/{requestNumber}")]
    public async Task<IActionResult> GetByRequestNumber(string requestNumber)
    {
        var result = await _destroyService.GetByRequestNumberAsync(requestNumber);
        if (result == null)
            return NotFound("销毁申请不存在");
        return Success(result);
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] DestroyQuery query)
    {
        var result = await _destroyService.SearchAsync(query);
        return Success(result);
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "4")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveDestroyRequest request)
    {
        var result = await _destroyService.ApproveAsync(id, request, CurrentUserId, CurrentUsername);
        return Success(result, request.IsApproved ? "审批通过" : "审批驳回");
    }

    [HttpPost("{id}/execute")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> Execute(Guid id, [FromBody] ExecuteDestroyRequest request)
    {
        var result = await _destroyService.ExecuteDestroyAsync(id, request, CurrentUserId);
        return Success(result, "销毁已执行");
    }

    [HttpGet("evidence/{evidenceId}")]
    public async Task<IActionResult> GetByEvidenceId(Guid evidenceId)
    {
        var result = await _destroyService.GetByEvidenceIdAsync(evidenceId);
        return Success(result);
    }
}
