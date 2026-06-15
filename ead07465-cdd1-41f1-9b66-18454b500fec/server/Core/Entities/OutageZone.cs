using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public class OutageZone
{
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    public string ZoneName { get; set; } = string.Empty;
    public List<GeoPoint> Polygon { get; set; } = new();
    public List<Guid> AffectedPipeIds { get; set; } = new();
    public List<Guid> AffectedValveIds { get; set; } = new();
    public int EstimatedUserCount { get; set; }
    public string? NotificationText { get; set; }
    public bool IsApproved { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? PlannedStartTime { get; set; }
    public DateTime? PlannedEndTime { get; set; }
    public DateTime CreatedAt { get; set; }
}
