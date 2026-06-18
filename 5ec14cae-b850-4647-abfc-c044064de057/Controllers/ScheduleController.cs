using ElderlyCareSystem.Models;
using ElderlyCareSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElderlyCareSystem.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ScheduleController : ControllerBase
{
    private readonly IScheduleService _service;

    public ScheduleController(IScheduleService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<ShiftSchedule>>> GetAll([FromQuery] string? facilityId = null)
    {
        return await _service.GetAllAsync(facilityId);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ShiftSchedule>> GetById(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost]
    public async Task<ActionResult<ShiftSchedule>> Create([FromBody] ShiftSchedule schedule)
    {
        try
        {
            var result = await _service.CreateAsync(schedule);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] ShiftSchedule schedule)
    {
        try
        {
            await _service.UpdateAsync(id, schedule);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        try
        {
            await _service.DeleteAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("range")]
    public async Task<ActionResult<List<ShiftSchedule>>> GetByDateRange([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByDateRangeAsync(startDate, endDate, facilityId);
    }

    [HttpGet("staff/{staffId}")]
    public async Task<ActionResult<List<ShiftSchedule>>> GetByStaff(string staffId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        return await _service.GetByStaffAsync(staffId, startDate, endDate);
    }

    [HttpGet("carezone/{careZone}/date/{date}")]
    public async Task<ActionResult<List<ShiftSchedule>>> GetByCareZone(string careZone, DateTime date, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByCareZoneAsync(careZone, date, facilityId);
    }

    [HttpGet("check-conflicts")]
    public async Task<ActionResult<List<ScheduleConflict>>> CheckConflicts([FromQuery] string staffId, [FromQuery] DateTime shiftDate, [FromQuery] DateTime startTime, [FromQuery] DateTime endTime, [FromQuery] string? excludeScheduleId = null)
    {
        return await _service.CheckConflictsAsync(staffId, shiftDate, startTime, endTime, excludeScheduleId);
    }

    [HttpPost("from-template")]
    public async Task<ActionResult<ShiftSchedule>> CreateFromTemplate([FromQuery] string staffId, [FromQuery] string templateId, [FromQuery] DateTime shiftDate, [FromQuery] string? facilityId = null)
    {
        try
        {
            var result = await _service.CreateFromTemplateAsync(staffId, templateId, shiftDate, facilityId);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("{scheduleId}/leave")]
    public async Task<IActionResult> RequestLeave(string scheduleId, [FromBody] LeaveRequest request)
    {
        try
        {
            await _service.RequestLeaveAsync(scheduleId, request);
            return Ok(new { message = "请假申请已提交" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("leave/{requestId}/approve")]
    public async Task<IActionResult> ApproveLeave(string requestId, [FromQuery] bool approved, [FromQuery] string approverId, [FromQuery] string approverName, [FromQuery] string? notes = null)
    {
        try
        {
            await _service.ApproveLeaveAsync(requestId, approved, approverId, approverName, notes);
            return Ok(new { message = approved ? "已批准请假" : "已拒绝请假" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("{scheduleId}/swap")]
    public async Task<IActionResult> RequestSwap(string scheduleId, [FromQuery] string targetStaffId, [FromQuery] string targetScheduleId)
    {
        try
        {
            await _service.RequestSwapAsync(scheduleId, targetStaffId, targetScheduleId);
            return Ok(new { message = "调班申请已提交" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{scheduleId}/swap/approve")]
    public async Task<IActionResult> ApproveSwap(string scheduleId, [FromQuery] bool approved)
    {
        try
        {
            await _service.ApproveSwapAsync(scheduleId, approved);
            return Ok(new { message = approved ? "调班已批准" : "调班已拒绝" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{scheduleId}/clock-in")]
    public async Task<IActionResult> ClockIn(string scheduleId, [FromQuery] string location)
    {
        try
        {
            await _service.ClockInAsync(scheduleId, location);
            return Ok(new { message = "上班打卡成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{scheduleId}/clock-out")]
    public async Task<IActionResult> ClockOut(string scheduleId, [FromQuery] string location)
    {
        try
        {
            await _service.ClockOutAsync(scheduleId, location);
            return Ok(new { message = "下班打卡成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("staff")]
    public async Task<ActionResult<List<Staff>>> GetAllStaff([FromQuery] string? facilityId = null)
    {
        return await _service.GetAllStaffAsync(facilityId);
    }

    [HttpPost("staff")]
    public async Task<ActionResult<Staff>> CreateStaff([FromBody] Staff staff)
    {
        var result = await _service.CreateStaffAsync(staff);
        return CreatedAtAction(nameof(GetAllStaff), result);
    }

    [HttpGet("templates")]
    public async Task<ActionResult<List<ShiftTemplate>>> GetAllTemplates()
    {
        return await _service.GetAllTemplatesAsync();
    }

    [HttpPost("templates")]
    public async Task<ActionResult<ShiftTemplate>> CreateTemplate([FromBody] ShiftTemplate template)
    {
        var result = await _service.CreateTemplateAsync(template);
        return CreatedAtAction(nameof(GetAllTemplates), result);
    }

    [HttpPost("generate-weekly")]
    public async Task<ActionResult<List<ShiftSchedule>>> GenerateWeeklySchedule([FromQuery] DateTime weekStart, [FromQuery] string? facilityId = null)
    {
        return await _service.GenerateWeeklyScheduleAsync(weekStart, facilityId);
    }
}
