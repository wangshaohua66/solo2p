using ElderlyCareSystem.Models;
using ElderlyCareSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElderlyCareSystem.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class BillingController : ControllerBase
{
    private readonly IBillingService _service;

    public BillingController(IBillingService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<Bill>>> GetAll([FromQuery] string? facilityId = null)
    {
        return await _service.GetAllAsync(facilityId);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Bill>> GetById(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result == null) return NotFound();
        return result;
    }

    [HttpPost]
    public async Task<ActionResult<Bill>> Create([FromBody] Bill bill)
    {
        var result = await _service.CreateAsync(bill);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] Bill bill)
    {
        try
        {
            await _service.UpdateAsync(id, bill);
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
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("elderly/{elderlyId}")]
    public async Task<ActionResult<List<Bill>>> GetByElderlyId(string elderlyId)
    {
        return await _service.GetByElderlyIdAsync(elderlyId);
    }

    [HttpGet("period/{period}")]
    public async Task<ActionResult<List<Bill>>> GetByPeriod(string period, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByPeriodAsync(period, facilityId);
    }

    [HttpGet("payment-status/{status}")]
    public async Task<ActionResult<List<Bill>>> GetByPaymentStatus(string status, [FromQuery] string? facilityId = null)
    {
        return await _service.GetByPaymentStatusAsync(status, facilityId);
    }

    [HttpPost("{billId}/payments")]
    public async Task<IActionResult> AddPayment(string billId, [FromBody] PaymentRecord payment)
    {
        try
        {
            await _service.AddPaymentAsync(billId, payment);
            return Ok(new { message = "支付记录已添加" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{billId}/reimbursement-docs")]
    public async Task<IActionResult> AddReimbursementDoc(string billId, [FromBody] ReimbursementDocument doc)
    {
        await _service.AddReimbursementDocAsync(billId, doc);
        return Ok(new { message = "报销材料已上传" });
    }

    [HttpGet("summary/{period}")]
    public async Task<ActionResult<BillingSummary>> GetBillingSummary(string period, [FromQuery] string? facilityId = null)
    {
        return await _service.GetBillingSummaryAsync(period, facilityId);
    }

    [HttpPost("generate-monthly/{year}/{month}")]
    public async Task<ActionResult<List<Bill>>> GenerateMonthlyBills(int year, int month, [FromQuery] string? facilityId = null)
    {
        return await _service.GenerateMonthlyBillsAsync(year, month, facilityId);
    }

    [HttpGet("auto-generate-items/{elderlyId}/{year}/{month}")]
    public async Task<ActionResult<List<BillItem>>> AutoGenerateBillItems(string elderlyId, int year, int month)
    {
        return await _service.AutoGenerateBillItemsAsync(elderlyId, year, month);
    }

    [HttpGet("{billId}/export-reimbursement")]
    public async Task<IActionResult> ExportReimbursementPackage(string billId)
    {
        try
        {
            var data = await _service.ExportReimbursementPackageAsync(billId);
            return File(data, "application/zip", $"reimbursement-{billId}.zip");
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("yearly-summary/{year}")]
    public async Task<ActionResult<List<BillingSummary>>> GetYearlySummary(int year, [FromQuery] string? facilityId = null)
    {
        return await _service.GetYearlySummaryAsync(year, facilityId);
    }

    [HttpGet("overdue")]
    public async Task<ActionResult<List<Bill>>> GetOverdueBills([FromQuery] string? facilityId = null)
    {
        return await _service.GetOverdueBillsAsync(facilityId);
    }

    [HttpPost("{billId}/send-reminder")]
    public async Task<IActionResult> SendPaymentReminder(string billId)
    {
        try
        {
            await _service.SendPaymentReminderAsync(billId);
            return Ok(new { message = "催缴通知已发送" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
