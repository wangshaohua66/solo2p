using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public enum InspectionStatus
{
    Pending = 0,
    InProgress = 1,
    Completed = 2,
    ExceptionReported = 3
}

public class InspectionTask
{
    public Guid Id { get; set; }
    public string TaskNo { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public InspectionStatus Status { get; set; }
    public Guid? InspectorId { get; set; }
    public string? InspectorName { get; set; }
    public List<Guid> TargetPipeIds { get; set; } = new();
    public List<GeoPoint> RoutePoints { get; set; } = new();
    public DateTime? PlanStartTime { get; set; }
    public DateTime? PlanEndTime { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public string? Remark { get; set; }
    public List<InspectionReport> Reports { get; set; } = new();
    public Guid? RelatedLeakEventId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class InspectionReport
{
    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public string? Description { get; set; }
    public bool IsAbnormal { get; set; }
    public List<string> PhotoUrls { get; set; } = new();
    public Guid? ReporterId { get; set; }
    public DateTime ReportTime { get; set; }
}
