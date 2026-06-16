namespace ColdChainLogistics.Models.Entities;

public class SensorData
{
    public long Id { get; set; }
    public long SensorId { get; set; }
    public long? VehicleId { get; set; }
    public long? ShipmentId { get; set; }
    public DateTime Timestamp { get; set; }
    public double Temperature { get; set; }
    public double Humidity { get; set; }
    public DataQuality Quality { get; set; } = DataQuality.Normal;
    public string? ValidationErrors { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? RawPayload { get; set; }

    public Sensor? Sensor { get; set; }
    public Vehicle? Vehicle { get; set; }
    public Shipment? Shipment { get; set; }
}
