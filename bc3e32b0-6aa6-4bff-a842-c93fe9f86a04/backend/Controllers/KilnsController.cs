using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KilnsController : ControllerBase
{
    private readonly IKilnService _kilnService;

    public KilnsController(IKilnService kilnService)
    {
        _kilnService = kilnService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<Kiln>>>> GetKilns()
    {
        var kilns = await _kilnService.GetKilnsAsync();
        return Ok(ApiResponse<List<Kiln>>.Success(kilns));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Kiln>>> GetKiln(Guid id)
    {
        var kiln = await _kilnService.GetKilnByIdAsync(id);
        if (kiln == null)
            return NotFound(ApiResponse.Fail("窑炉不存在", 404));

        return Ok(ApiResponse<Kiln>.Success(kiln));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<Kiln>>> CreateKiln([FromBody] Kiln kiln)
    {
        var result = await _kilnService.CreateKilnAsync(kiln);
        return CreatedAtAction(nameof(GetKiln), new { id = result.Id }, ApiResponse<Kiln>.Success(result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<Kiln>>> UpdateKiln(Guid id, [FromBody] Kiln kiln)
    {
        try
        {
            var result = await _kilnService.UpdateKilnAsync(id, kiln);
            return Ok(ApiResponse<Kiln>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteKiln(Guid id)
    {
        try
        {
            await _kilnService.DeleteKilnAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("schedules")]
    public async Task<ActionResult<ApiResponse<List<KilnSchedule>>>> GetSchedules(
        [FromQuery] Guid? kilnId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] FiringType? firingType = null,
        [FromQuery] ScheduleStatus? status = null)
    {
        var schedules = await _kilnService.GetSchedulesAsync(kilnId, startDate, endDate, firingType, status);
        return Ok(ApiResponse<List<KilnSchedule>>.Success(schedules));
    }

    [HttpGet("schedules/{id}")]
    public async Task<ActionResult<ApiResponse<KilnSchedule>>> GetSchedule(Guid id)
    {
        var schedule = await _kilnService.GetScheduleByIdAsync(id);
        if (schedule == null)
            return NotFound(ApiResponse.Fail("排程不存在", 404));

        return Ok(ApiResponse<KilnSchedule>.Success(schedule));
    }

    [HttpPost("schedules")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<KilnSchedule>>> CreateSchedule(
        [FromBody] KilnSchedule schedule,
        [FromQuery] bool forceOverride = false)
    {
        try
        {
            var result = await _kilnService.CreateScheduleAsync(schedule, forceOverride);
            return CreatedAtAction(nameof(GetSchedule), new { id = result.Id }, ApiResponse<KilnSchedule>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message, 409));
        }
    }

    [HttpPut("schedules/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<KilnSchedule>>> UpdateSchedule(
        Guid id,
        [FromBody] KilnSchedule schedule,
        [FromQuery] bool forceOverride = false)
    {
        try
        {
            var result = await _kilnService.UpdateScheduleAsync(id, schedule, forceOverride);
            return Ok(ApiResponse<KilnSchedule>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            if (ex.Message.Contains("不存在"))
                return NotFound(ApiResponse.Fail(ex.Message, 404));
            return BadRequest(ApiResponse.Fail(ex.Message, 409));
        }
    }

    [HttpDelete("schedules/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse>> DeleteSchedule(Guid id)
    {
        try
        {
            await _kilnService.DeleteScheduleAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("schedules/check-conflict")]
    public async Task<ActionResult<ApiResponse<ConflictResult>>> CheckConflict(
        [FromQuery] Guid kilnId,
        [FromQuery] DateTime startTime,
        [FromQuery] DateTime endTime,
        [FromQuery] Guid? excludeId = null)
    {
        var result = await _kilnService.CheckConflictAsync(kilnId, startTime, endTime, excludeId);
        return Ok(ApiResponse<ConflictResult>.Success(result));
    }

    [HttpPost("schedules/{id}/start")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<KilnSchedule>>> StartFiring(Guid id)
    {
        try
        {
            var result = await _kilnService.StartFiringAsync(id);
            return Ok(ApiResponse<KilnSchedule>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("schedules/{id}/complete")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<KilnSchedule>>> CompleteFiring(Guid id)
    {
        try
        {
            var result = await _kilnService.CompleteFiringAsync(id);
            return Ok(ApiResponse<KilnSchedule>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("schedules/{id}/cancel")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<KilnSchedule>>> CancelSchedule(Guid id)
    {
        try
        {
            var result = await _kilnService.CancelScheduleAsync(id);
            return Ok(ApiResponse<KilnSchedule>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("firing-records")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<PagedResult<FiringRecord>>>> GetFiringRecords(
        [FromQuery] Guid? kilnId = null,
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize };
        var result = await _kilnService.GetFiringRecordsAsync(kilnId, query);
        return Ok(ApiResponse<PagedResult<FiringRecord>>.Success(result));
    }

    [HttpGet("usage")]
    public async Task<ActionResult<ApiResponse<object>>> GetKilnUsage(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var result = await _kilnService.GetKilnUsageAsync(startDate, endDate);
        return Ok(ApiResponse<object>.Success(result));
    }
}
