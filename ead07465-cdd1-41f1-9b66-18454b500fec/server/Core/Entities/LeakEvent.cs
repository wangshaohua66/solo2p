using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public enum LeakEventStatus
{
    Detected = 0,
    Confirmed = 1,
    Repairing = 2,
    Resolved = 3,
    FalseAlarm = 4
}

public enum LeakSeverity
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

public class LeakEvent
{
    public Guid Id { get; set; }
    public string EventNo { get; set; } = string.Empty;
    public LeakEventStatus Status { get; set; }
    public LeakSeverity Severity { get; set; }
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public double Confidence { get; set; }
    public double? EstimatedRadius { get; set; }
    public string? Description { get; set; }
    public string? Source { get; set; }
    public List<Guid> AbnormalNodeIds { get; set; } = new();
    public List<LeakCandidatePoint> CandidatePoints { get; set; } = new();
    public Guid? NearestNodeId { get; set; }
    public double? DistanceToNearestNode { get; set; }
    public Guid? RelatedWorkOrderId { get; set; }
    public DateTime DetectedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public Guid? ConfirmedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class LeakCandidatePoint
{
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public double Probability { get; set; }
}
