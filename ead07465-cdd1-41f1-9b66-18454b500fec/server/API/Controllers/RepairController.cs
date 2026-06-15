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
public class RepairController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IRepairDispatchService _dispatchService;
    private readonly IOutagePredictService _outageService;
    private readonly IHubContext<DispatchHub> _hubContext;

    public RepairController(
        IUnitOfWork unitOfWork,
        IRepairDispatchService dispatchService,
        IOutagePredictService outageService,
        IHubContext<DispatchHub> hubContext)
    {
        _unitOfWork = unitOfWork;
        _dispatchService = dispatchService;
        _outageService = outageService;
        _hubContext = hubContext;
    }

    [HttpGet("work-orders")]
    public async Task<IActionResult> GetWorkOrders(
        [FromQuery] WorkOrderStatus? status,
        [FromQuery] Guid? teamId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = _unitOfWork.RepairWorkOrders.Query()
            .Include(w => w.AssignedTeam);

        if (status.HasValue) query = query.Where(w => w.Status == status.Value);
        if (teamId.HasValue) query = query.Where(w => w.AssignedTeamId == teamId.Value);

        var total = await query.CountAsync(ct);
        var orders = await query
            .OrderByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Ok(new { Total = total, Page = page, PageSize = pageSize, Data = orders });
    }

    [HttpGet("work-orders/{id}")]
    public async Task<IActionResult> GetWorkOrder(Guid id, CancellationToken ct)
    {
        var order = await _unitOfWork.RepairWorkOrders.Query()
            .Include(w => w.AssignedTeam)
            .Include(w => w.StatusLogs)
            .Include(w => w.ValveOperations)
            .Include(w => w.OutageZone)
            .FirstOrDefaultAsync(w => w.Id == id, ct);

        if (order == null) return NotFound();
        return Ok(order);
    }

    [HttpPost("work-orders")]
    public async Task<IActionResult> CreateWorkOrder([FromBody] CreateWorkOrderRequest request, CancellationToken ct)
    {
        if (request.LeakEventId.HasValue)
        {
            var order = await _dispatchService.CreateWorkOrderFromLeakAsync(
                request.LeakEventId.Value, request.Title, request.Description, ct);
            await _hubContext.Clients.All.SendAsync("WorkOrderCreated", order, ct);
            return Ok(order);
        }

        var newOrder = new RepairWorkOrder
        {
            Id = Guid.NewGuid(),
            OrderNo = $"WO{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(100, 999)}",
            Title = request.Title,
            Description = request.Description,
            Status = WorkOrderStatus.Created,
            Priority = request.Priority,
            Longitude = request.Longitude,
            Latitude = request.Latitude,
            Address = request.Address,
            Deadline = DateTime.UtcNow.AddMinutes(30),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            StatusLogs = new List<WorkOrderStatusLog>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    FromStatus = (WorkOrderStatus)(-1),
                    ToStatus = WorkOrderStatus.Created,
                    Remark = "工单创建",
                    CreatedAt = DateTime.UtcNow
                }
            }
        };

        await _unitOfWork.RepairWorkOrders.AddAsync(newOrder, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        await _hubContext.Clients.All.SendAsync("WorkOrderCreated", newOrder, ct);
        return Ok(newOrder);
    }

    [HttpPost("work-orders/{id}/dispatch")]
    public async Task<IActionResult> DispatchOrder(Guid id, [FromBody] DispatchRequest request, CancellationToken ct)
    {
        var result = await _dispatchService.DispatchWorkOrderAsync(id, request.TeamId, ct);
        if (!result) return BadRequest(new { message = "Dispatch failed" });

        var order = await _unitOfWork.RepairWorkOrders.Query()
            .Include(w => w.AssignedTeam)
            .FirstOrDefaultAsync(w => w.Id == id, ct);

        await _hubContext.Clients.All.SendAsync("WorkOrderUpdated", order, ct);
        return Ok(order);
    }

    [HttpPost("work-orders/{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request, CancellationToken ct)
    {
        var result = await _dispatchService.UpdateWorkOrderStatusAsync(
            id, request.NewStatus, request.OperatorId, request.Remark, ct);
        if (!result) return BadRequest(new { message = "Invalid status transition" });

        var order = await _unitOfWork.RepairWorkOrders.Query()
            .Include(w => w.AssignedTeam)
            .FirstOrDefaultAsync(w => w.Id == id, ct);

        await _hubContext.Clients.All.SendAsync("WorkOrderUpdated", order, ct);
        return Ok(order);
    }

    [HttpPost("outage/predict")]
    public async Task<IActionResult> PredictOutage([FromBody] PredictOutageRequest request, CancellationToken ct)
    {
        var zone = await _outageService.PredictOutageZoneAsync(request.ValveIds, ct);
        zone.PlannedStartTime = request.PlannedStartTime;
        zone.PlannedEndTime = request.PlannedEndTime;
        zone.EstimatedUserCount = await _outageService.EstimateAffectedUsersAsync(zone, ct);
        zone.NotificationText = await _outageService.GenerateNotificationDraftAsync(zone, ct);
        return Ok(zone);
    }

    [HttpPost("work-orders/{id}/outage")]
    public async Task<IActionResult> SaveOutageZone(Guid id, [FromBody] OutageZone zone, CancellationToken ct)
    {
        var order = await _unitOfWork.RepairWorkOrders.GetByIdAsync(id, ct);
        if (order == null) return NotFound();

        zone.Id = Guid.NewGuid();
        zone.WorkOrderId = id;
        zone.CreatedAt = DateTime.UtcNow;
        await _unitOfWork.OutageZones.AddAsync(zone, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        order.OutageZone = zone;
        order.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        await _hubContext.Clients.All.SendAsync("OutageZoneCreated", new { WorkOrderId = id, Zone = zone }, ct);
        return Ok(zone);
    }

    [HttpPost("outage/{id}/approve")]
    public async Task<IActionResult> ApproveOutage(Guid id, [FromQuery] Guid operatorId, CancellationToken ct)
    {
        var zone = await _unitOfWork.OutageZones.GetByIdAsync(id, ct);
        if (zone == null) return NotFound();

        zone.IsApproved = true;
        zone.ApprovedBy = operatorId;
        zone.ApprovedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(zone);
    }

    [HttpGet("teams")]
    public async Task<IActionResult> GetTeams([FromQuery] TeamStatus? status, CancellationToken ct)
    {
        var query = _unitOfWork.RepairTeams.Query();
        if (status.HasValue) query = query.Where(t => t.Status == status.Value);
        var teams = await query.ToListAsync(ct);
        return Ok(teams);
    }

    [HttpGet("teams/{id}")]
    public async Task<IActionResult> GetTeam(Guid id, CancellationToken ct)
    {
        var team = await _unitOfWork.RepairTeams.GetByIdAsync(id, ct);
        if (team == null) return NotFound();
        return Ok(team);
    }

    [HttpGet("teams/nearest")]
    public async Task<IActionResult> GetNearestTeam(
        [FromQuery] double longitude,
        [FromQuery] double latitude,
        [FromQuery] string? district,
        CancellationToken ct)
    {
        var team = await _dispatchService.FindNearestIdleTeamAsync(longitude, latitude, district, ct);
        if (team == null) return NotFound(new { message = "No idle team available" });
        return Ok(team);
    }

    [HttpPost("teams/{id}/position")]
    public async Task<IActionResult> UpdateTeamPosition(Guid id, [FromBody] PositionUpdate request, CancellationToken ct)
    {
        var result = await _dispatchService.UpdateTeamPositionAsync(id, request.Longitude, request.Latitude, ct);
        if (!result) return NotFound();

        var team = await _unitOfWork.RepairTeams.GetByIdAsync(id, ct);
        await _hubContext.Clients.All.SendAsync("TeamPositionUpdated", team, ct);
        return Ok(team);
    }

    [HttpGet("valves")]
    public async Task<IActionResult> GetValves(CancellationToken ct)
    {
        var valves = await _unitOfWork.Valves.GetAllAsync(ct);
        return Ok(valves);
    }

    [HttpPost("check-timeout")]
    public async Task<IActionResult> CheckTimeout(CancellationToken ct)
    {
        await _dispatchService.CheckAndEscalateTimeoutOrdersAsync(ct);
        return Ok(new { Success = true });
    }
}

public record CreateWorkOrderRequest(
    [Required] string Title,
    string? Description,
    int Priority = 2,
    [Required] double Longitude,
    [Required] double Latitude,
    string? Address,
    Guid? LeakEventId);

public record DispatchRequest([Required] Guid TeamId);

public record UpdateStatusRequest(
    [Required] WorkOrderStatus NewStatus,
    Guid? OperatorId,
    string? Remark);

public record PredictOutageRequest(
    [Required] List<Guid> ValveIds,
    DateTime? PlannedStartTime,
    DateTime? PlannedEndTime);

public record PositionUpdate([Required] double Longitude, [Required] double Latitude);
