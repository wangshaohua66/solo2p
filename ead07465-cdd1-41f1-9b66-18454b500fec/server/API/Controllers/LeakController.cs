using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WaterDispatch.Core.Entities;
using WaterDispatch.Core.Interfaces;
using WaterDispatch.Core.Services;
using WaterDispatch.API.Hubs;

namespace WaterDispatch.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeakController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILeakDetectService _leakDetectService;
    private readonly IHubContext<DispatchHub> _hubContext;

    public LeakController(IUnitOfWork unitOfWork, ILeakDetectService leakDetectService, IHubContext<DispatchHub> hubContext)
    {
        _unitOfWork = unitOfWork;
        _leakDetectService = leakDetectService;
        _hubContext = hubContext;
    }

    [HttpGet("events")]
    public async Task<IActionResult> GetEvents(
        [FromQuery] LeakEventStatus? status,
        [FromQuery] LeakSeverity? severity,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = _unitOfWork.LeakEvents.Query();
        if (status.HasValue) query = query.Where(e => e.Status == status.Value);
        if (severity.HasValue) query = query.Where(e => e.Severity >= severity.Value);

        var total = await query.CountAsync(ct);
        var events = await query
            .OrderByDescending(e => e.DetectedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Ok(new { Total = total, Page = page, PageSize = pageSize, Data = events });
    }

    [HttpGet("events/{id}")]
    public async Task<IActionResult> GetEvent(Guid id, CancellationToken ct)
    {
        var leak = await _unitOfWork.LeakEvents.GetByIdAsync(id, ct);
        if (leak == null) return NotFound();
        return Ok(leak);
    }

    [HttpPost("events/{id}/confirm")]
    public async Task<IActionResult> ConfirmEvent(Guid id, [FromQuery] Guid? operatorId, CancellationToken ct = default)
    {
        var leak = await _unitOfWork.LeakEvents.GetByIdAsync(id, ct);
        if (leak == null) return NotFound();

        leak.Status = LeakEventStatus.Confirmed;
        leak.ConfirmedAt = DateTime.UtcNow;
        leak.ConfirmedBy = operatorId;
        leak.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        await _hubContext.Clients.All.SendAsync("LeakEventUpdated", leak, ct);
        return Ok(leak);
    }

    [HttpPost("events/{id}/resolve")]
    public async Task<IActionResult> ResolveEvent(Guid id, CancellationToken ct)
    {
        var leak = await _unitOfWork.LeakEvents.GetByIdAsync(id, ct);
        if (leak == null) return NotFound();

        leak.Status = LeakEventStatus.Resolved;
        leak.ResolvedAt = DateTime.UtcNow;
        leak.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        await _hubContext.Clients.All.SendAsync("LeakEventUpdated", leak, ct);
        return Ok(leak);
    }

    [HttpGet("detect/abnormal-nodes")]
    public async Task<IActionResult> GetAbnormalNodes(CancellationToken ct)
    {
        var abnormal = await _leakDetectService.DetectAbnormalNodesAsync(ct);
        return Ok(abnormal);
    }

    [HttpPost("detect/locate")]
    public async Task<IActionResult> LocateLeak([FromBody] LocateLeakRequest request, CancellationToken ct)
    {
        var result = await _leakDetectService.LocateLeakAsync(request.AbnormalNodeIds, ct);
        return Ok(result);
    }

    [HttpPost("detect/create-event")]
    public async Task<IActionResult> CreateLeakEvent([FromBody] LocateLeakRequest request, CancellationToken ct)
    {
        var leak = await _leakDetectService.CreateLeakEventAsync(request.AbnormalNodeIds, ct);
        await _hubContext.Clients.All.SendAsync("NewLeakEvent", leak, ct);
        return Ok(leak);
    }

    [HttpGet("health/maintenance-list")]
    public async Task<IActionResult> GetMaintenanceList([FromQuery] int topN = 50, CancellationToken ct = default)
    {
        var pipes = await _leakDetectService.GeneratePreventiveMaintenanceListAsync(topN, ct);
        return Ok(pipes);
    }

    [HttpGet("pipes/health/{id}")]
    public async Task<IActionResult> GetPipeHealth(Guid id, CancellationToken ct)
    {
        var pipe = await _unitOfWork.Pipes.GetByIdAsync(id, ct);
        if (pipe == null) return NotFound();
        var score = await _leakDetectService.CalculatePipeHealthScoreAsync(pipe, ct);
        return Ok(new { pipe.Id, pipe.Code, pipe.Name, HealthScore = score, RiskLevel = pipe.RiskLevel });
    }

    [HttpGet("pipes")]
    public async Task<IActionResult> GetPipes(CancellationToken ct)
    {
        var pipes = await _unitOfWork.Pipes.GetAllAsync(ct);
        return Ok(pipes);
    }

    [HttpGet("monitor-nodes")]
    public async Task<IActionResult> GetMonitorNodes(CancellationToken ct)
    {
        var nodes = await _unitOfWork.MonitorNodes.GetAllAsync(ct);
        return Ok(nodes);
    }

    [HttpPost("monitor-nodes/reading")]
    public async Task<IActionResult> SubmitPressureReading([FromBody] PressureReadingRequest request, CancellationToken ct)
    {
        var node = await _unitOfWork.MonitorNodes.GetByIdAsync(request.NodeId, ct);
        if (node == null) return NotFound(new { message = "Monitor node not found" });

        node.CurrentPressure = request.Pressure;
        node.CurrentFlow = request.Flow;
        node.LastReadingTime = DateTime.UtcNow;
        node.IsOnline = true;

        var isAnomaly = await _leakDetectService.IsPressureAnomalyAsync(request.NodeId, request.Pressure, ct);
        if (isAnomaly) node.HasAlarm = true;

        var reading = new PressureReading
        {
            NodeId = request.NodeId,
            Pressure = request.Pressure,
            Flow = request.Flow,
            ReadingTime = DateTime.UtcNow,
            IsAnomaly = isAnomaly,
            AnomalyType = isAnomaly ? (request.Pressure < node.NormalPressureMin ? "LOW_PRESSURE" : "HIGH_PRESSURE") : null,
            PartitionKey = DateTime.UtcNow.Year * 100 + DateTime.UtcNow.Month
        };

        await _unitOfWork.PressureReadings.AddAsync(reading, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _hubContext.Clients.All.SendAsync("PressureUpdated", new
        {
            node.Id,
            node.Code,
            node.Name,
            Pressure = request.Pressure,
            Flow = request.Flow,
            ReadingTime = reading.ReadingTime,
            IsAnomaly = isAnomaly
        }, ct);

        if (isAnomaly)
        {
            await _hubContext.Clients.All.SendAsync("PressureAlarm", new
            {
                node.Id,
                node.Code,
                node.Name,
                Pressure = request.Pressure,
                node.Longitude,
                node.Latitude,
                ThresholdMin = node.NormalPressureMin,
                ThresholdMax = node.NormalPressureMax,
                ReadingTime = reading.ReadingTime
            }, ct);
        }

        return Ok(new { Success = true, IsAnomaly = isAnomaly });
    }
}

public record LocateLeakRequest([Required] List<Guid> AbnormalNodeIds);

public record PressureReadingRequest(
    [Required] Guid NodeId,
    [Range(0, 10)] double Pressure,
    double? Flow);
