namespace ColdChainLogistics.Models.Entities;

public class DeviceMaintenanceWindow : BaseEntity
{
    public long SensorId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Reason { get; set; }
    public string? CreatedBy { get; set; }

    public Sensor? Sensor { get; set; }
}
