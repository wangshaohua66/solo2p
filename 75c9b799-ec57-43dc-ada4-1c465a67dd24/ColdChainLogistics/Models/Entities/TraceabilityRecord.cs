namespace ColdChainLogistics.Models.Entities;

public class TraceabilityRecord : BaseEntity
{
    public string TraceId { get; set; } = string.Empty;
    public long ShipmentId { get; set; }
    public long? BatchId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public string NodeType { get; set; } = string.Empty;
    public string NodeName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public double? Temperature { get; set; }
    public double? Humidity { get; set; }
    public string? Location { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? OperatorName { get; set; }
    public string? Remark { get; set; }
    public string? DataHash { get; set; }
    public string? PreviousHash { get; set; }

    public Shipment? Shipment { get; set; }
    public ShipmentBatch? Batch { get; set; }
}
