using System;
using System.Collections.Generic;

namespace WaterDispatch.Core.Entities;

public class MonitorNode
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public double NormalPressureMin { get; set; } = 0.15;
    public double NormalPressureMax { get; set; } = 0.45;
    public double? CurrentPressure { get; set; }
    public double? CurrentFlow { get; set; }
    public DateTime? LastReadingTime { get; set; }
    public bool IsOnline { get; set; }
    public bool HasAlarm { get; set; }
    public string? ScadaStation { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<PressureReading> PressureReadings { get; set; } = new List<PressureReading>();
}
