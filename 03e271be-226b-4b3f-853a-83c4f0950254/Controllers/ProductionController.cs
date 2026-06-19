using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Models.DTOs;
using MiningGovApi.Services;

namespace MiningGovApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductionController : BaseController
{
    private readonly IProductionService _service;

    public ProductionController(IProductionService service)
    {
        _service = service;
    }

    [HttpPost]
    [Authorize(Roles = "MineManager")]
    public async Task<IActionResult> Create([FromBody] ProductionReportCreateDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.CreateAsync(dto, user.Id);
        return Success(result, "产量数据上报成功");
    }

    [HttpPost("batch")]
    [Authorize(Roles = "MineManager")]
    public async Task<IActionResult> BatchCreate([FromBody] ProductionReportBatchCreateDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var count = await _service.BatchCreateAsync(dto.Reports, user.Id);
        return Success(new { Count = count }, $"批量上报成功，共{count}条记录");
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);
        return Success(result);
    }

    [HttpGet("query")]
    public async Task<IActionResult> Query([FromQuery] ProductionReportQueryDto query)
    {
        var result = await _service.QueryAsync(query);
        return Success(result);
    }

    [HttpPost("verify")]
    [Authorize(Roles = "SafetyInspector,MiningApprover")]
    public async Task<IActionResult> Verify([FromBody] ProductionReportVerifyDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.VerifyAsync(dto, user.Id);
        return Success(result, dto.Verified ? "核查通过" : "核查标记异常");
    }

    [HttpPost("calculate-fees")]
    [Authorize(Roles = "MiningApprover")]
    public async Task<IActionResult> CalculateFees([FromQuery] int year, [FromQuery] int quarter)
    {
        await _service.CalculateFeesAsync(year, quarter);
        return Success("费款核算完成");
    }
}
