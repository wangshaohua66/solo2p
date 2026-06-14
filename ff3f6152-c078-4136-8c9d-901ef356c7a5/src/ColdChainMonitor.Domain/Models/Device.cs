using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Models;

public class Device
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [BsonElement("deviceName")]
    public string DeviceName { get; set; } = string.Empty;

    [BsonElement("deviceType")]
    public string DeviceType { get; set; } = "TemperatureHumiditySensor";

    [BsonElement("status")]
    public DeviceStatus Status { get; set; } = DeviceStatus.Inactive;

    [BsonElement("vehicleId")]
    public string? VehicleId { get; set; }

    [BsonElement("vehiclePlate")]
    public string? VehiclePlate { get; set; }

    [BsonElement("batteryLevel")]
    public double BatteryLevel { get; set; } = 100.0;

    [BsonElement("firmwareVersion")]
    public string? FirmwareVersion { get; set; }

    [BsonElement("lastReportAt")]
    public DateTime? LastReportAt { get; set; }

    [BsonElement("lastKnownLocation")]
    public GpsLocation? LastKnownLocation { get; set; }

    [BsonElement("offlineThresholdMinutes")]
    public int OfflineThresholdMinutes { get; set; } = 10;

    [BsonElement("lowBatteryThreshold")]
    public double LowBatteryThreshold { get; set; } = 20.0;

    [BsonElement("installedAt")]
    public DateTime? InstalledAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class GpsLocation
{
    [BsonElement("latitude")]
    public double Latitude { get; set; }

    [BsonElement("longitude")]
    public double Longitude { get; set; }

    [BsonElement("accuracy")]
    public double? Accuracy { get; set; }

    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
