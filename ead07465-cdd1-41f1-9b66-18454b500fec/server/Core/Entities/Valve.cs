using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public class Valve
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public double Diameter { get; set; }
    public string? ValveType { get; set; }
    public bool IsOpen { get; set; }
    public Guid? DownstreamPipeId { get; set; }
    public List<Guid> AffectedPipeIds { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ValveOperation
{
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    public Guid ValveId { get; set; }
    public bool TargetState { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? OperatorId { get; set; }
    public DateTime CreatedAt { get; set; }
}
