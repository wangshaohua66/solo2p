using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Models.DTOs;
using MiningGovApi.Services;

namespace MiningGovApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TradeController : BaseController
{
    private readonly ITradeService _service;

    public TradeController(ITradeService service)
    {
        _service = service;
    }

    [HttpPost("list")]
    [Authorize(Roles = "MineManager,TradeOfficer")]
    public async Task<IActionResult> CreateListing([FromBody] TradeOrderCreateDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.CreateListingAsync(dto, user.Id);
        return Success(result, "交易挂牌成功");
    }

    [HttpPost("bid")]
    [Authorize(Roles = "MineManager,TradeOfficer")]
    public async Task<IActionResult> SubmitBid([FromBody] TradeOrderBidDto dto)
    {
        var result = await _service.SubmitBidAsync(dto);
        return Success(result, "报价已提交");
    }

    [HttpPost("review")]
    [Authorize(Roles = "TradeOfficer")]
    public async Task<IActionResult> Review([FromBody] TradeOrderReviewDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.ReviewAsync(dto, user.Id);
        return Success(result, dto.Approved ? "审核通过" : "审核驳回");
    }

    [HttpPost("recheck")]
    [Authorize(Roles = "TradeOfficer")]
    public async Task<IActionResult> Recheck([FromBody] TradeOrderRecheckDto dto)
    {
        var user = HttpContext.RequireCurrentUser();
        var result = await _service.RecheckAsync(dto, user.Id);
        return Success(result, dto.Approved ? "复核通过" : "复核驳回");
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);
        return Success(result);
    }

    [HttpGet("query")]
    public async Task<IActionResult> Query([FromQuery] TradeOrderQueryDto query)
    {
        var result = await _service.QueryAsync(query);
        return Success(result);
    }
}
