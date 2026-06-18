using ElderlyCareSystem.Models;
using ElderlyCareSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElderlyCareSystem.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ElderlyController : ControllerBase
{
    private readonly IElderlyService _service;

    public ElderlyController(IElderlyService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<ElderlyProfile>>> GetAll([FromQuery] string? facilityId = null)
    {
        return await _service.GetAllAsync(facilityId);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ElderlyProfile>> GetById(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost]
    public async Task<ActionResult<ElderlyProfile>> Create([FromBody] ElderlyProfile profile)
    {
        try
        {
            var result = await _service.CreateAsync(profile);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] ElderlyProfile profile)
    {
        try
        {
            await _service.UpdateAsync(id, profile);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
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

    [HttpGet("search")]
    public async Task<ActionResult<List<ElderlyProfile>>> Search([FromQuery] string keyword, [FromQuery] string? facilityId = null)
    {
        return await _service.SearchAsync(keyword, facilityId);
    }

    [HttpGet("idcard/{idCardNumber}")]
    public async Task<ActionResult<ElderlyProfile>> GetByIdCard(string idCardNumber)
    {
        var result = await _service.GetByIdCardAsync(idCardNumber);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost("{id}/checkin")]
    public async Task<IActionResult> CheckIn(string id, [FromQuery] string bedId, [FromQuery] string operatorName)
    {
        try
        {
            await _service.CheckInAsync(id, bedId, operatorName);
            return Ok(new { message = "入住成功" });
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

    [HttpPost("{id}/checkout")]
    public async Task<IActionResult> CheckOut(string id, [FromQuery] string operatorName, [FromQuery] string? reason = null)
    {
        try
        {
            await _service.CheckOutAsync(id, operatorName, reason);
            return Ok(new { message = "退床成功" });
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

    [HttpPost("{id}/attachments")]
    public async Task<IActionResult> AddAttachment(string id, [FromBody] Attachment attachment)
    {
        try
        {
            await _service.AddAttachmentAsync(id, attachment);
            return Ok(new { message = "附件添加成功" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}/attachments/{attachmentId}")]
    public async Task<IActionResult> DeleteAttachment(string id, string attachmentId)
    {
        try
        {
            await _service.DeleteAttachmentAsync(id, attachmentId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/carelevel-assessment")]
    public async Task<IActionResult> UpdateCareLevelAssessment(string id, [FromBody] CareLevelAssessment assessment)
    {
        try
        {
            await _service.UpdateCareLevelAssessmentAsync(id, assessment);
            return Ok(new { message = "照护等级评定已更新" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("count")]
    public async Task<ActionResult<long>> Count([FromQuery] string? facilityId = null, [FromQuery] string? status = null)
    {
        return await _service.CountAsync(facilityId, status);
    }
}
