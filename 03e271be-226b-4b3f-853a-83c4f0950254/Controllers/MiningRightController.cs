using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;
using MiningGovApi.Services;

namespace MiningGovApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MiningRightController : BaseController
{
    private readonly IMiningRightService _service;

    public MiningRightController(IMiningRightService service)
    {
        _service = service;
    }

    [HttpPost]
    [Authorize(Roles = "MineManager,MiningApprover")]
    public async Task<IActionResult> Create([FromBody] MiningRightCreateDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.CreateAsync(dto, user.Id);
        return Success(result, "矿权申请创建成功");
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);
        return Success(result);
    }

    [HttpGet("query")]
    public async Task<IActionResult> Query([FromQuery] MiningRightQueryDto query)
    {
        var result = await _service.QueryAsync(query);
        return Success(result);
    }

    [HttpPost("{id}/submit")]
    [Authorize(Roles = "MineManager,MiningApprover")]
    public async Task<IActionResult> SubmitForApproval(int id)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.SubmitForApprovalAsync(id, user.Id);
        return Success(result, "已提交审批");
    }

    [HttpPost("approve")]
    [Authorize(Roles = "MiningApprover")]
    public async Task<IActionResult> Approve([FromBody] MiningRightApprovalDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.ApproveAsync(dto, user.Id);
        return Success(result, dto.Status == ApprovalStatus.Approved ? "审批通过" : "审批驳回");
    }
}
