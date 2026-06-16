namespace ColdChainLogistics.Models.DTOs;

public class SensorDataItemDto
{
    public string DeviceId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public double Temperature { get; set; }
    public double Humidity { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? RawPayload { get; set; }
}

public class SensorDataBatchRequest
{
    public string VehicleNumber { get; set; } = string.Empty;
    public List<SensorDataItemDto> Data { get; set; } = new();
}

public class SensorDataBatchResponse
{
    public int TotalCount { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public List<SensorDataErrorItem>? FailedItems { get; set; }
    public int AlertCount { get; set; }
}

public class SensorDataErrorItem
{
    public string DeviceId { get; set; } = string.Empty;
    public string ErrorCode { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
}

public class SensorDataQueryRequest : PagedRequest
{
    public long? SensorId { get; set; }
    public long? VehicleId { get; set; }
    public long? ShipmentId { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? Quality { get; set; }
}

public class SensorDataDto
{
    public long Id { get; set; }
    public long SensorId { get; set; }
    public string SensorCode { get; set; } = string.Empty;
    public long? VehicleId { get; set; }
    public long? ShipmentId { get; set; }
    public DateTime Timestamp { get; set; }
    public double Temperature { get; set; }
    public double Humidity { get; set; }
    public int Quality { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
