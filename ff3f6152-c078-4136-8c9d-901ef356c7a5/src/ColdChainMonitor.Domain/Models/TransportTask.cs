using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Models;

public class TransportTask
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("taskNo")]
    public string TaskNo { get; set; } = string.Empty;

    [BsonElement("status")]
    public TransportStatus Status { get; set; } = TransportStatus.Pending;

    [BsonElement("drugBatch")]
    public DrugBatchInfo DrugBatch { get; set; } = new();

    [BsonElement("vehicle")]
    public VehicleInfo Vehicle { get; set; } = new();

    [BsonElement("driver")]
    public DriverInfo Driver { get; set; } = new();

    [BsonElement("origin")]
    public LocationInfo Origin { get; set; } = new();

    [BsonElement("destination")]
    public LocationInfo Destination { get; set; } = new();

    [BsonElement("deviceIds")]
    public List<string> DeviceIds { get; set; } = new();

    [BsonElement("temperatureRange")]
    public TemperatureRange TemperatureRange { get; set; } = new();

    [BsonElement("plannedDepartureAt")]
    public DateTime PlannedDepartureAt { get; set; }

    [BsonElement("plannedArrivalAt")]
    public DateTime PlannedArrivalAt { get; set; }

    [BsonElement("actualDepartureAt")]
    public DateTime? ActualDepartureAt { get; set; }

    [BsonElement("actualArrivalAt")]
    public DateTime? ActualArrivalAt { get; set; }

    [BsonElement("loadingRecord")]
    public LoadingRecord? LoadingRecord { get; set; }

    [BsonElement("unloadingRecord")]
    public LoadingRecord? UnloadingRecord { get; set; }

    [BsonElement("alertCount")]
    public int AlertCount { get; set; } = 0;

    [BsonElement("criticalAlertCount")]
    public int CriticalAlertCount { get; set; } = 0;

    [BsonElement("statusHistory")]
    public List<StatusChangeRecord> StatusHistory { get; set; } = new();

    [BsonElement("createdBy")]
    public string CreatedBy { get; set; } = string.Empty;

    [BsonElement("createdByName")]
    public string CreatedByName { get; set; } = string.Empty;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class DrugBatchInfo
{
    [BsonElement("batchNo")]
    public string BatchNo { get; set; } = string.Empty;

    [BsonElement("drugName")]
    public string DrugName { get; set; } = string.Empty;

    [BsonElement("drugType")]
    public string DrugType { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("unit")]
    public string Unit { get; set; } = "箱";

    [BsonElement("manufacturer")]
    public string? Manufacturer { get; set; }

    [BsonElement("productionDate")]
    public DateTime? ProductionDate { get; set; }

    [BsonElement("expiryDate")]
    public DateTime? ExpiryDate { get; set; }
}

public class VehicleInfo
{
    [BsonElement("vehicleId")]
    public string VehicleId { get; set; } = string.Empty;

    [BsonElement("plateNumber")]
    public string PlateNumber { get; set; } = string.Empty;

    [BsonElement("vehicleType")]
    public string? VehicleType { get; set; }

    [BsonElement("refrigerationModel")]
    public string? RefrigerationModel { get; set; }
}

public class DriverInfo
{
    [BsonElement("driverId")]
    public string DriverId { get; set; } = string.Empty;

    [BsonElement("driverName")]
    public string DriverName { get; set; } = string.Empty;

    [BsonElement("phone")]
    public string? Phone { get; set; }
}

public class LocationInfo
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;

    [BsonElement("contact")]
    public string? Contact { get; set; }

    [BsonElement("phone")]
    public string? Phone { get; set; }
}

public class TemperatureRange
{
    [BsonElement("minTemp")]
    public double MinTemp { get; set; } = 2.0;

    [BsonElement("maxTemp")]
    public double MaxTemp { get; set; } = 8.0;

    [BsonElement("minHumidity")]
    public double? MinHumidity { get; set; }

    [BsonElement("maxHumidity")]
    public double? MaxHumidity { get; set; }
}

public class LoadingRecord
{
    [BsonElement("operationType")]
    public OperationType OperationType { get; set; }

    [BsonElement("operatorId")]
    public string OperatorId { get; set; } = string.Empty;

    [BsonElement("operatorName")]
    public string OperatorName { get; set; } = string.Empty;

    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [BsonElement("location")]
    public GpsLocation? Location { get; set; }

    [BsonElement("temperatureSnapshot")]
    public List<TemperatureSnapshot> TemperatureSnapshots { get; set; } = new();

    [BsonElement("remarks")]
    public string? Remarks { get; set; }
}

public class TemperatureSnapshot
{
    [BsonElement("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [BsonElement("temperature")]
    public double Temperature { get; set; }

    [BsonElement("humidity")]
    public double? Humidity { get; set; }
}

public class StatusChangeRecord
{
    [BsonElement("fromStatus")]
    public TransportStatus FromStatus { get; set; }

    [BsonElement("toStatus")]
    public TransportStatus ToStatus { get; set; }

    [BsonElement("operatorId")]
    public string OperatorId { get; set; } = string.Empty;

    [BsonElement("operatorName")]
    public string OperatorName { get; set; } = string.Empty;

    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [BsonElement("remarks")]
    public string? Remarks { get; set; }
}
