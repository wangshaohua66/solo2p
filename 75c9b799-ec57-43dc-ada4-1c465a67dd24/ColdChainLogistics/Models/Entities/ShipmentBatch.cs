namespace ColdChainLogistics.Models.Entities;

public class ShipmentBatch : BaseEntity
{
    public string BatchNumber { get; set; } = string.Empty;
    public long ShipmentId { get; set; }
    public long WarehouseId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductCategory { get; set; }
    public int Quantity { get; set; }
    public string? Unit { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public DateTime? InboundTime { get; set; }
    public DateTime? OutboundTime { get; set; }
    public string? StorageCondition { get; set; }
    public double? TemperatureRequirementMin { get; set; }
    public double? TemperatureRequirementMax { get; set; }

    public Shipment? Shipment { get; set; }
    public Warehouse? Warehouse { get; set; }
    public ICollection<TraceabilityRecord> TraceabilityRecords { get; set; } = new List<TraceabilityRecord>();
}
