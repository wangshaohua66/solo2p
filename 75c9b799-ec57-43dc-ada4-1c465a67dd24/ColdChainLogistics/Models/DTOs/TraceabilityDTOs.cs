namespace ColdChainLogistics.Models.DTOs;

public class TraceabilityQueryRequest
{
    public string? BatchNumber { get; set; }
    public long? ShipmentId { get; set; }
    public string? ShipmentNumber { get; set; }
}

public class TraceabilityResponse
{
    public string BatchNumber { get; set; } = string.Empty;
    public string? ShipmentNumber { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public List<TraceabilityNodeDto> Nodes { get; set; } = new();
    public List<TraceabilitySensorDataDto>? SensorDataTimeline { get; set; }
    public TemperatureStatisticsDto? Statistics { get; set; }
}

public class TraceabilityNodeDto
{
    public int Sequence { get; set; }
    public string NodeType { get; set; } = string.Empty;
    public string NodeName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public double? Temperature { get; set; }
    public double? Humidity { get; set; }
    public string? Location { get; set; }
    public string? OperatorName { get; set; }
    public string? Remark { get; set; }
    public string? DataHash { get; set; }
}

public class TraceabilitySensorDataDto
{
    public DateTime Timestamp { get; set; }
    public double Temperature { get; set; }
    public double Humidity { get; set; }
    public string? SensorCode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class TemperatureStatisticsDto
{
    public double MinTemperature { get; set; }
    public double MaxTemperature { get; set; }
    public double AvgTemperature { get; set; }
    public double MinHumidity { get; set; }
    public double MaxHumidity { get; set; }
    public double AvgHumidity { get; set; }
    public int OverLimitCount { get; set; }
    public double OverLimitDurationMinutes { get; set; }
}
