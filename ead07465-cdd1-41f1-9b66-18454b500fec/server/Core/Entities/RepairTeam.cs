using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public enum TeamStatus
{
    Idle = 0,
    OnDuty = 1,
    OnSite = 2,
    Repairing = 3,
    Resting = 4
}

public class RepairTeam
{
    public Guid Id { get; set; }
    public string TeamCode { get; set; } = string.Empty;
    public string TeamName { get; set; } = string.Empty;
    public TeamStatus Status { get; set; }
    public string? LeaderName { get; set; }
    public string? LeaderPhone { get; set; }
    public int MemberCount { get; set; }
    public List<string> Vehicles { get; set; } = new();
    public List<string> Equipment { get; set; } = new();
    public double? CurrentLongitude { get; set; }
    public double? CurrentLatitude { get; set; }
    public DateTime? LastPositionUpdate { get; set; }
    public string District { get; set; } = string.Empty;
    public Guid? CurrentWorkOrderId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<RepairWorkOrder> WorkOrders { get; set; } = new List<RepairWorkOrder>();
}
