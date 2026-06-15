using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public class Pipe
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double Diameter { get; set; }
    public string Material { get; set; } = string.Empty;
    public int InstallYear { get; set; }
    public double BuriedDepth { get; set; }
    public double Length { get; set; }
    public List<GeoPoint> Geometry { get; set; } = new();
    public Guid StartNodeId { get; set; }
    public Guid EndNodeId { get; set; }
    public int RepairCount { get; set; }
    public double HealthScore { get; set; }
    public int RiskLevel { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class GeoPoint
{
    public double Longitude { get; set; }
    public double Latitude { get; set; }
}
