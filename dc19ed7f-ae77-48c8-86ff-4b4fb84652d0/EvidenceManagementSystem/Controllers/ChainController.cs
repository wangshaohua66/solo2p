using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/chain")]
[Produces("application/json")]
[Authorize]
public class ChainController : BaseController
{
    private readonly IChainService _chainService;
    private readonly ILogger<ChainController> _logger;

    public ChainController(IChainService chainService, ILogger<ChainController> logger)
    {
        _chainService = chainService;
        _logger = logger;
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _chainService.GetByIdAsync(id);
        if (result == null)
            return NotFound("流转记录不存在");
        return Success(result);
    }

    [HttpGet("evidence/{evidenceId}")]
    public async Task<IActionResult> GetByEvidenceId(Guid evidenceId)
    {
        var result = await _chainService.GetChainByEvidenceIdAsync(evidenceId);
        return Success(result);
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] ChainQuery query)
    {
        var result = await _chainService.SearchAsync(query);
        return Success(result);
    }

    [HttpGet("evidence/{evidenceId}/forward")]
    public async Task<IActionResult> GetForward(Guid evidenceId, [FromQuery] DateTime fromTime)
    {
        var result = await _chainService.GetChainForwardAsync(evidenceId, fromTime);
        return Success(result);
    }

    [HttpGet("evidence/{evidenceId}/backward")]
    public async Task<IActionResult> GetBackward(Guid evidenceId, [FromQuery] DateTime toTime)
    {
        var result = await _chainService.GetChainBackwardAsync(evidenceId, toTime);
        return Success(result);
    }

    [HttpGet("evidence/{evidenceId}/verify")]
    public async Task<IActionResult> VerifyIntegrity(Guid evidenceId)
    {
        var isValid = await _chainService.VerifyChainIntegrityAsync(evidenceId);
        return Success(new { IsValid = isValid }, isValid ? "链式数据完整" : "链式数据存在篡改");
    }
}
