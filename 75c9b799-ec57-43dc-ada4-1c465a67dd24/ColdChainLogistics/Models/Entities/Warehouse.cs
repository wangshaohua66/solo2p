namespace ColdChainLogistics.Models.Entities;

public class Warehouse : BaseEntity
{
    public string WarehouseCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public double Area { get; set; }
    public string? TemperatureZone { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Sensor> Sensors { get; set; } = new List<Sensor>();
    public ICollection<ShipmentBatch> InventoryBatches { get; set; } = new List<ShipmentBatch>();
    public ICollection<WarehouseEnvRecord> EnvRecords { get; set; } = new List<WarehouseEnvRecord>();
}

public class WarehouseEnvRecord : BaseEntity
{
    public long WarehouseId { get; set; }
    public long SensorId { get; set; }
    public DateTime RecordTime { get; set; }
    public double Temperature { get; set; }
    public double Humidity { get; set; }
    public DataQuality Quality { get; set; } = DataQuality.Normal;

    public Warehouse? Warehouse { get; set; }
    public Sensor? Sensor { get; set; }
}
