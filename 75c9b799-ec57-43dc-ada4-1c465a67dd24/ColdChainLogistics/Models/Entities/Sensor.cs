namespace ColdChainLogistics.Models.Entities;

public class Sensor : BaseEntity
{
    public string SensorCode { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public SensorType Type { get; set; }
    public long? VehicleId { get; set; }
    public long? WarehouseId { get; set; }
    public string? LocationDescription { get; set; }
    public SensorStatus Status { get; set; } = SensorStatus.Active;
    public double TemperatureMin { get; set; } = -30;
    public double TemperatureMax { get; set; } = 40;
    public double HumidityMin { get; set; } = 0;
    public double HumidityMax { get; set; } = 100;
    public int ReportIntervalSeconds { get; set; } = 30;
    public int OfflineThresholdMinutes { get; set; } = 5;
    public DateTime? LastReportTime { get; set; }
    public double? LastTemperature { get; set; }
    public double? LastHumidity { get; set; }

    public Vehicle? Vehicle { get; set; }
    public Warehouse? Warehouse { get; set; }
    public ICollection<DeviceMaintenanceWindow> MaintenanceWindows { get; set; } = new List<DeviceMaintenanceWindow>();
}
