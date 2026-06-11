using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;
using System.Security.Claims;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MembersController : ControllerBase
{
    private readonly IMemberService _memberService;

    public MembersController(IMemberService memberService)
    {
        _memberService = memberService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<User>>>> GetMembers(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] MemberTier? tier = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _memberService.GetMembersAsync(query, tier);
        return Ok(ApiResponse<PagedResult<User>>.Success(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<User>>> GetMember(Guid id)
    {
        var member = await _memberService.GetMemberByIdAsync(id);
        if (member == null)
            return NotFound(ApiResponse.Fail("会员不存在", 404));

        return Ok(ApiResponse<User>.Success(member));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<User>>> CreateMember([FromBody] CreateMemberRequest request)
    {
        try
        {
            var member = await _memberService.CreateMemberAsync(request.User, request.Password);
            return CreatedAtAction(nameof(GetMember), new { id = member.Id }, ApiResponse<User>.Success(member));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<User>>> UpdateMember(Guid id, [FromBody] User user)
    {
        try
        {
            var member = await _memberService.UpdateMemberAsync(id, user);
            return Ok(ApiResponse<User>.Success(member));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteMember(Guid id)
    {
        try
        {
            await _memberService.DeleteMemberAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpPost("{id}/upgrade")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<User>>> UpgradeTier(Guid id, [FromBody] UpgradeTierRequest request)
    {
        try
        {
            var member = await _memberService.UpgradeTierAsync(id, request.Tier, request.DurationMonths);
            return Ok(ApiResponse<User>.Success(member));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("benefits")]
    public async Task<ActionResult<ApiResponse<MemberTierBenefit[]>>> GetTierBenefits()
    {
        var benefits = await _memberService.GetTierBenefitsAsync();
        return Ok(ApiResponse<MemberTierBenefit[]>.Success(benefits));
    }

    [HttpGet("growth")]
    public async Task<ActionResult<ApiResponse<object>>> GetMemberGrowth([FromQuery] int months = 6)
    {
        var result = await _memberService.GetMemberGrowthAsync(months);
        return Ok(ApiResponse<object>.Success(result));
    }

    [HttpGet("{id}/pieces")]
    public async Task<ActionResult<ApiResponse<PagedResult<PieceArchive>>>> GetMemberPieces(
        Guid id,
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize };
        var result = await _memberService.GetMemberPiecesAsync(id, query);
        return Ok(ApiResponse<PagedResult<PieceArchive>>.Success(result));
    }

    [HttpGet("{id}/courses")]
    public async Task<ActionResult<ApiResponse<PagedResult<CourseRegistration>>>> GetMemberCourses(
        Guid id,
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize };
        var result = await _memberService.GetMemberCoursesAsync(id, query);
        return Ok(ApiResponse<PagedResult<CourseRegistration>>.Success(result));
    }

    [HttpGet("{id}/points")]
    public async Task<ActionResult<ApiResponse<object>>> GetMemberPoints(Guid id)
    {
        var (points, totalHours) = await _memberService.GetMemberPointsAsync(id);
        return Ok(ApiResponse<object>.Success(new { points, totalHours }));
    }
}

public class CreateMemberRequest
{
    public User User { get; set; } = new();
    public string Password { get; set; } = string.Empty;
}

public class UpgradeTierRequest
{
    public MemberTier Tier { get; set; }
    public int DurationMonths { get; set; }
}
