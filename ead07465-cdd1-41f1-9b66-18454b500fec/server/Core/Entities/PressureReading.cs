using System;

namespace WaterDispatch.Core.Entities;

public class PressureReading
{
    public long Id { get; set; }
    public Guid NodeId { get; set; }
    public MonitorNode Node { get; set; } = null!;
    public double Pressure { get; set; }
    public double? Flow { get; set; }
    public DateTime ReadingTime { get; set; }
    public bool IsAnomaly { get; set; }
    public string? AnomalyType { get; set; }
    public int PartitionKey { get; set; }
}
