using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public enum WorkOrderStatus
{
    Created = 0,
    Dispatched = 1,
    Accepted = 2,
    OnSite = 3,
    Repairing = 4,
    Completed = 5,
    AcceptedClosed = 6,
    Cancelled = 7
}

public class RepairWorkOrder
{
    public Guid Id { get; set; }
    public string OrderNo { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public WorkOrderStatus Status { get; set; }
    public int Priority { get; set; }
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public string? Address { get; set; }
    public Guid? LeakEventId { get; set; }
    public Guid? AssignedTeamId { get; set; }
    public RepairTeam? AssignedTeam { get; set; }
    public DateTime? Deadline { get; set; }
    public bool IsTimeoutEscalated { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? AcceptedBy { get; set; }
    public List<WorkOrderStatusLog> StatusLogs { get; set; } = new();
    public List<ValveOperation> ValveOperations { get; set; } = new();
    public OutageZone? OutageZone { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? OnSiteAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class WorkOrderStatusLog
{
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    public WorkOrderStatus FromStatus { get; set; }
    public WorkOrderStatus ToStatus { get; set; }
    public string? Remark { get; set; }
    public Guid? OperatorId { get; set; }
    public DateTime CreatedAt { get; set; }
}
