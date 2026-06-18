using ElderlyCareSystem.Models;
using ElderlyCareSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElderlyCareSystem.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class MedicationController : ControllerBase
{
    private readonly IMedicationService _service;

    public MedicationController(IMedicationService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<MedicationRecord>>> GetAll([FromQuery] string? facilityId = null)
    {
        return await _service.GetAllAsync(facilityId);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<MedicationRecord>> GetById(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost]
    public async Task<ActionResult<MedicationRecord>> Create([FromBody] MedicationRecord record)
    {
        try
        {
            var result = await _service.CreateAsync(record);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] MedicationRecord record)
    {
        try
        {
            await _service.UpdateAsync(id, record);
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

    [HttpGet("elderly/{elderlyId}")]
    public async Task<ActionResult<List<MedicationRecord>>> GetByElderlyId(string elderlyId)
    {
        return await _service.GetByElderlyIdAsync(elderlyId);
    }

    [HttpGet("elderly/{elderlyId}/active")]
    public async Task<ActionResult<List<MedicationRecord>>> GetActiveByElderlyId(string elderlyId)
    {
        return await _service.GetActiveByElderlyIdAsync(elderlyId);
    }

    [HttpGet("date/{date}")]
    public async Task<ActionResult<List<MedicationRecord>>> GetByDate(DateTime date, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByDateAsync(date, facilityId);
    }

    [HttpPost("{recordId}/administer")]
    public async Task<IActionResult> AdministerMedication(string recordId, [FromBody] AdministrationLog log, [FromQuery] string administeredBy, [FromQuery] string administeredById)
    {
        try
        {
            await _service.AdministerMedicationAsync(recordId, log, administeredBy, administeredById);
            return Ok(new { message = "给药确认成功" });
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

    [HttpPost("{recordId}/mark-missed")]
    public async Task<IActionResult> MarkMissed(string recordId, [FromQuery] DateTime date, [FromQuery] string scheduledTime, [FromQuery] string? reason = null)
    {
        try
        {
            var time = TimeSpan.Parse(scheduledTime);
            await _service.MarkMissedAsync(recordId, date, time, reason);
            return Ok(new { message = "已标记为漏服" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("alerts")]
    public async Task<ActionResult<List<MedicationAlert>>> GetActiveAlerts([FromQuery] string? facilityId = null)
    {
        return await _service.GetActiveAlertsAsync(facilityId);
    }

    [HttpPost("{recordId}/alerts/{alertId}/acknowledge")]
    public async Task<IActionResult> AcknowledgeAlert(string recordId, string alertId, [FromQuery] string acknowledgedBy)
    {
        try
        {
            await _service.AcknowledgeAlertAsync(recordId, alertId, acknowledgedBy);
            return Ok(new { message = "告警已确认" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("prescriptions")]
    public async Task<ActionResult<List<MedicationPrescription>>> GetAllPrescriptions([FromQuery] string? facilityId = null)
    {
        return await _service.GetAllPrescriptionsAsync(facilityId);
    }

    [HttpGet("prescriptions/{id}")]
    public async Task<ActionResult<MedicationPrescription>> GetPrescriptionById(string id)
    {
        var result = await _service.GetPrescriptionByIdAsync(id);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost("prescriptions")]
    public async Task<ActionResult<MedicationPrescription>> CreatePrescription([FromBody] MedicationPrescription prescription)
    {
        var result = await _service.CreatePrescriptionAsync(prescription);
        return CreatedAtAction(nameof(GetPrescriptionById), new { id = result.Id }, result);
    }

    [HttpPost("prescriptions/{prescriptionId}/generate-records")]
    public async Task<ActionResult<List<MedicationRecord>>> GenerateFromPrescription(string prescriptionId)
    {
        try
        {
            return await _service.GenerateFromPrescriptionAsync(prescriptionId);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("today")]
    public async Task<ActionResult<List<MedicationRecord>>> GetTodayMedicationList([FromQuery] string? facilityId = null)
    {
        return await _service.GetTodayMedicationListAsync(facilityId);
    }

    [HttpGet("pending-now")]
    public async Task<ActionResult<List<MedicationRecord>>> GetPendingNow([FromQuery] string? facilityId = null)
    {
        return await _service.GetPendingNowAsync(facilityId);
    }

    [HttpGet("compliance-report/{elderlyId}")]
    public async Task<ActionResult<MedicationComplianceReport>> GetComplianceReport(string elderlyId, [FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
    {
        return await _service.GetComplianceReportAsync(elderlyId, startDate, endDate);
    }

    [HttpGet("daily-stats")]
    public async Task<ActionResult<object>> GetDailyStats([FromQuery] DateTime date, [FromQuery] string? facilityId = null)
    {
        var (total, administered, missed, late) = await _service.GetDailyStatsAsync(date, facilityId);
        return new { total, administered, missed, late, complianceRate = total > 0 ? Math.Round((decimal)administered / total * 100, 2) : 100 };
    }

    [HttpPost("check-missed")]
    public async Task<IActionResult> CheckMissedDoses([FromQuery] int timeoutMinutes = 30)
    {
        await _service.CheckMissedDosesAsync(timeoutMinutes);
        return Ok(new { message = "漏服检查完成" });
    }
}
