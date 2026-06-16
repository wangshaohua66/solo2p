using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/evidences")]
[Produces("application/json")]
[Authorize]
public class EvidenceController : BaseController
{
    private readonly IEvidenceService _evidenceService;
    private readonly ILogger<EvidenceController> _logger;

    public EvidenceController(IEvidenceService evidenceService, ILogger<EvidenceController> logger)
    {
        _evidenceService = evidenceService;
        _logger = logger;
    }

    [HttpPost]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> Create([FromBody] CreateEvidenceRequest request)
    {
        var result = await _evidenceService.CreateAsync(request, CurrentUserId, CurrentUsername);
        return Created(result, "物证登记成功");
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _evidenceService.GetByIdAsync(id);
        if (result == null)
            return NotFound("物证不存在");
        return Success(result);
    }

    [HttpGet("barcode/{barcode}")]
    public async Task<IActionResult> GetByBarcode(string barcode)
    {
        var result = await _evidenceService.GetByBarcodeAsync(barcode);
        if (result == null)
            return NotFound("物证不存在");
        return Success(result);
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] EvidenceQuery query)
    {
        var result = await _evidenceService.SearchAsync(query);
        return Success(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEvidenceRequest request)
    {
        var result = await _evidenceService.UpdateAsync(id, request, CurrentUserId);
        return Success(result, "更新成功");
    }

    [HttpPost("inbound")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> Inbound([FromBody] InboundRequest request)
    {
        var result = await _evidenceService.InboundAsync(request, CurrentUserId, CurrentUsername);
        return Success(result, "入库成功");
    }

    [HttpPost("outbound")]
    [Authorize(Roles = "1,2")]
    public async Task<IActionResult> Outbound([FromBody] OutboundRequest request)
    {
        var result = await _evidenceService.OutboundAsync(request, CurrentUserId, CurrentUsername);
        return Success(result, "出库成功");
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _evidenceService.DeleteAsync(id);
        if (!result)
            return NotFound("物证不存在");
        return Success("删除成功");
    }
}
