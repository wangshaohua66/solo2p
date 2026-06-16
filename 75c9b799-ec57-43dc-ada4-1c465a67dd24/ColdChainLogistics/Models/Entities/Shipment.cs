namespace ColdChainLogistics.Models.Entities;

public class Shipment : BaseEntity
{
    public string ShipmentNumber { get; set; } = string.Empty;
    public long CustomerId { get; set; }
    public long VehicleId { get; set; }
    public long OriginWarehouseId { get; set; }
    public string? Destination { get; set; }
    public string? RouteCode { get; set; }
    public ShipmentStatus Status { get; set; } = ShipmentStatus.Created;
    public DateTime? DepartureTime { get; set; }
    public DateTime? ArrivalTime { get; set; }
    public DateTime? SignTime { get; set; }
    public string? DriverName { get; set; }
    public string? DriverPhone { get; set; }
    public string? Remarks { get; set; }
    public double? TemperatureMin { get; set; }
    public double? TemperatureMax { get; set; }
    public double? HumidityMin { get; set; }
    public double? HumidityMax { get; set; }

    public Customer? Customer { get; set; }
    public Vehicle? Vehicle { get; set; }
    public Warehouse? OriginWarehouse { get; set; }
    public ICollection<ShipmentBatch> Batches { get; set; } = new List<ShipmentBatch>();
    public ICollection<SensorData> SensorData { get; set; } = new List<SensorData>();
    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
    public ICollection<TraceabilityRecord> TraceabilityRecords { get; set; } = new List<TraceabilityRecord>();
}
