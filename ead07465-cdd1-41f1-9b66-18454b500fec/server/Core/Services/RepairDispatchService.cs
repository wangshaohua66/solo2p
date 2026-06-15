using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WaterDispatch.Core.Entities;
using WaterDispatch.Core.Interfaces;

namespace WaterDispatch.Core.Services;

public class RepairDispatchService : IRepairDispatchService
{
    private readonly IUnitOfWork _unitOfWork;

    public RepairDispatchService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<RepairWorkOrder> CreateWorkOrderFromLeakAsync(Guid leakEventId, string title, string? description, CancellationToken ct = default)
    {
        var leakEvent = await _unitOfWork.LeakEvents.GetByIdAsync(leakEventId, ct)
            ?? throw new ArgumentException("Leak event not found");

        var workOrder = new RepairWorkOrder
        {
            Id = Guid.NewGuid(),
            OrderNo = $"WO{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(100, 999)}",
            Title = title,
            Description = description ?? leakEvent.Description,
            Status = WorkOrderStatus.Created,
            Priority = (int)leakEvent.Severity,
            Longitude = leakEvent.Longitude,
            Latitude = leakEvent.Latitude,
            LeakEventId = leakEventId,
            Deadline = DateTime.UtcNow.AddMinutes(30),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        workOrder.StatusLogs.Add(new WorkOrderStatusLog
        {
            Id = Guid.NewGuid(),
            WorkOrderId = workOrder.Id,
            FromStatus = (WorkOrderStatus)(-1),
            ToStatus = WorkOrderStatus.Created,
            Remark = "工单创建",
            CreatedAt = DateTime.UtcNow
        });

        leakEvent.RelatedWorkOrderId = workOrder.Id;
        leakEvent.Status = LeakEventStatus.Confirmed;
        leakEvent.ConfirmedAt = DateTime.UtcNow;

        await _unitOfWork.RepairWorkOrders.AddAsync(workOrder, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return workOrder;
    }

    public async Task<bool> DispatchWorkOrderAsync(Guid workOrderId, Guid teamId, CancellationToken ct = default)
    {
        var workOrder = await _unitOfWork.RepairWorkOrders.GetByIdAsync(workOrderId, ct)
            ?? throw new ArgumentException("Work order not found");

        var team = await _unitOfWork.RepairTeams.GetByIdAsync(teamId, ct)
            ?? throw new ArgumentException("Repair team not found");

        if (workOrder.Status != WorkOrderStatus.Created && workOrder.Status != WorkOrderStatus.Dispatched)
            return false;

        workOrder.AssignedTeamId = teamId;
        workOrder.Status = WorkOrderStatus.Dispatched;
        workOrder.UpdatedAt = DateTime.UtcNow;

        workOrder.StatusLogs.Add(new WorkOrderStatusLog
        {
            Id = Guid.NewGuid(),
            WorkOrderId = workOrder.Id,
            FromStatus = workOrder.StatusLogs.Last().ToStatus,
            ToStatus = WorkOrderStatus.Dispatched,
            Remark = $"派单至 {team.TeamName}",
            CreatedAt = DateTime.UtcNow
        });

        team.Status = TeamStatus.OnDuty;
        team.CurrentWorkOrderId = workOrder.Id;
        team.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> UpdateWorkOrderStatusAsync(Guid workOrderId, WorkOrderStatus newStatus, Guid? operatorId, string? remark = null, CancellationToken ct = default)
    {
        var workOrder = await _unitOfWork.RepairWorkOrders.GetByIdAsync(workOrderId, ct)
            ?? throw new ArgumentException("Work order not found");

        if (!IsValidStatusTransition(workOrder.Status, newStatus))
            return false;

        var oldStatus = workOrder.Status;
        workOrder.Status = newStatus;
        workOrder.UpdatedAt = DateTime.UtcNow;

        switch (newStatus)
        {
            case WorkOrderStatus.Accepted:
                workOrder.AcceptedAt = DateTime.UtcNow;
                workOrder.AcceptedBy = operatorId;
                break;
            case WorkOrderStatus.OnSite:
                workOrder.OnSiteAt = DateTime.UtcNow;
                break;
            case WorkOrderStatus.Completed:
            case WorkOrderStatus.AcceptedClosed:
                workOrder.CompletedAt = DateTime.UtcNow;
                workOrder.IsTimeoutEscalated = false;
                if (workOrder.AssignedTeamId.HasValue)
                {
                    var team = await _unitOfWork.RepairTeams.GetByIdAsync(workOrder.AssignedTeamId.Value, ct);
                    if (team != null)
                    {
                        team.Status = TeamStatus.Idle;
                        team.CurrentWorkOrderId = null;
                        team.UpdatedAt = DateTime.UtcNow;
                    }
                }
                if (workOrder.LeakEventId.HasValue)
                {
                    var leak = await _unitOfWork.LeakEvents.GetByIdAsync(workOrder.LeakEventId.Value, ct);
                    if (leak != null)
                    {
                        leak.Status = LeakEventStatus.Resolved;
                        leak.ResolvedAt = DateTime.UtcNow;
                        leak.UpdatedAt = DateTime.UtcNow;
                    }
                }
                break;
        }

        workOrder.StatusLogs.Add(new WorkOrderStatusLog
        {
            Id = Guid.NewGuid(),
            WorkOrderId = workOrder.Id,
            FromStatus = oldStatus,
            ToStatus = newStatus,
            Remark = remark ?? GetStatusDescription(newStatus),
            OperatorId = operatorId,
            CreatedAt = DateTime.UtcNow
        });

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task CheckAndEscalateTimeoutOrdersAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var timeoutOrders = await _unitOfWork.RepairWorkOrders
            .Query()
            .Where(w => (w.Status == WorkOrderStatus.Created || w.Status == WorkOrderStatus.Dispatched)
                        && w.Deadline.HasValue && w.Deadline < now
                        && !w.IsTimeoutEscalated)
            .ToListAsync(ct);

        foreach (var order in timeoutOrders)
        {
            order.IsTimeoutEscalated = true;
            order.Priority = Math.Min(4, order.Priority + 1);
            order.UpdatedAt = now;
            order.StatusLogs.Add(new WorkOrderStatusLog
            {
                Id = Guid.NewGuid(),
                WorkOrderId = order.Id,
                FromStatus = order.Status,
                ToStatus = order.Status,
                Remark = $"工单超时告警，优先级升级至 {order.Priority}",
                CreatedAt = now
            });
        }

        await _unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<RepairTeam?> FindNearestIdleTeamAsync(double longitude, double latitude, string? district = null, CancellationToken ct = default)
    {
        var query = _unitOfWork.RepairTeams
            .Query()
            .Where(t => t.Status == TeamStatus.Idle);

        if (!string.IsNullOrEmpty(district))
        {
            query = query.Where(t => t.District == district);
        }

        var teams = await query.ToListAsync(ct);

        RepairTeam? nearest = null;
        double minDistance = double.MaxValue;

        foreach (var team in teams)
        {
            if (!team.CurrentLongitude.HasValue || !team.CurrentLatitude.HasValue)
                continue;

            var dist = CalculateDistance(longitude, latitude, team.CurrentLongitude.Value, team.CurrentLatitude.Value);
            if (dist < minDistance)
            {
                minDistance = dist;
                nearest = team;
            }
        }

        return nearest ?? teams.FirstOrDefault();
    }

    public async Task<bool> UpdateTeamPositionAsync(Guid teamId, double longitude, double latitude, CancellationToken ct = default)
    {
        var team = await _unitOfWork.RepairTeams.GetByIdAsync(teamId, ct);
        if (team == null) return false;

        team.CurrentLongitude = longitude;
        team.CurrentLatitude = latitude;
        team.LastPositionUpdate = DateTime.UtcNow;
        team.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    private static bool IsValidStatusTransition(WorkOrderStatus from, WorkOrderStatus to)
    {
        var transitions = new Dictionary<WorkOrderStatus, List<WorkOrderStatus>>
        {
            [WorkOrderStatus.Created] = new() { WorkOrderStatus.Dispatched, WorkOrderStatus.Cancelled },
            [WorkOrderStatus.Dispatched] = new() { WorkOrderStatus.Accepted, WorkOrderStatus.Cancelled },
            [WorkOrderStatus.Accepted] = new() { WorkOrderStatus.OnSite, WorkOrderStatus.Cancelled },
            [WorkOrderStatus.OnSite] = new() { WorkOrderStatus.Repairing },
            [WorkOrderStatus.Repairing] = new() { WorkOrderStatus.Completed },
            [WorkOrderStatus.Completed] = new() { WorkOrderStatus.AcceptedClosed },
        };

        return transitions.TryGetValue(from, out var valid) && valid.Contains(to);
    }

    private static string GetStatusDescription(WorkOrderStatus status) => status switch
    {
        WorkOrderStatus.Created => "工单创建",
        WorkOrderStatus.Dispatched => "工单已派发",
        WorkOrderStatus.Accepted => "抢修队已接单",
        WorkOrderStatus.OnSite => "抢修队已到场",
        WorkOrderStatus.Repairing => "修复中",
        WorkOrderStatus.Completed => "修复完成",
        WorkOrderStatus.AcceptedClosed => "验收通过已关闭",
        WorkOrderStatus.Cancelled => "工单已取消",
        _ => "状态变更"
    };

    private static double CalculateDistance(double lng1, double lat1, double lng2, double lat2)
    {
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return c * 6371000;
    }
}
