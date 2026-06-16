using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/overdue-warnings")]
[Produces("application/json")]
[Authorize]
public class OverdueWarningController : BaseController
{
    private readonly IOverdueWarningService _warningService;
    private readonly ILogger<OverdueWarningController> _logger;

    public OverdueWarningController(IOverdueWarningService warningService, ILogger<OverdueWarningController> logger)
    {
        _warningService = warningService;
        _logger = logger;
    }

    [HttpPost("generate")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> GenerateWarnings()
    {
        await _warningService.GenerateWarningsAsync();
        return Success("预警生成成功");
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] OverdueWarningQuery query)
    {
        var result = await _warningService.SearchAsync(query);
        return Success(result);
    }

    [HttpGet("unresolved")]
    public async Task<IActionResult> GetUnresolved()
    {
        var result = await _warningService.GetUnresolvedWarningsAsync();
        return Success(result);
    }

    [HttpPost("{id}/notified")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> MarkAsNotified(Guid id)
    {
        await _warningService.MarkAsNotifiedAsync(id);
        return Success("已标记为通知");
    }

    [HttpPost("{id}/resolve")]
    [Authorize(Roles = "4")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] string remark)
    {
        await _warningService.ResolveWarningAsync(id, remark);
        return Success("预警已解除");
    }

    [HttpGet("count/warning")]
    public async Task<IActionResult> GetWarningCount()
    {
        var count = await _warningService.GetWarningCountAsync();
        return Success(new { Count = count });
    }

    [HttpGet("count/overdue")]
    public async Task<IActionResult> GetOverdueCount()
    {
        var count = await _warningService.GetOverdueCountAsync();
        return Success(new { Count = count });
    }
}
