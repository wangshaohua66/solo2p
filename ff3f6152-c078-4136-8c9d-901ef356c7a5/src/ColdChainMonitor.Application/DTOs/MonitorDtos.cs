using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.DTOs;

public class TemperatureReportRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public double Temperature { get; set; }
    public double? Humidity { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? Accuracy { get; set; }
    public double? BatteryLevel { get; set; }
    public int? SignalStrength { get; set; }
    public DateTime? Timestamp { get; set; }
}

public class TemperatureReadingDto
{
    public string Id { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public double Temperature { get; set; }
    public double? Humidity { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? BatteryLevel { get; set; }
    public bool IsAnomaly { get; set; }
}

public class TemperatureHistoryQuery : CursorPagedQuery
{
    public string DeviceId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

public class RealTimeMonitorDto
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public string? VehicleId { get; set; }
    public string? VehiclePlate { get; set; }
    public double CurrentTemperature { get; set; }
    public double? CurrentHumidity { get; set; }
    public double? BatteryLevel { get; set; }
    public DateTime LastReportAt { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public bool IsOnline { get; set; }
    public bool HasAlert { get; set; }
    public string? TransportTaskId { get; set; }
    public string? TaskNo { get; set; }
}

public class TemperatureStatsDto
{
    public string DeviceId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public double AvgTemperature { get; set; }
    public double MaxTemperature { get; set; }
    public double MinTemperature { get; set; }
    public double? AvgHumidity { get; set; }
    public double? MaxHumidity { get; set; }
    public double? MinHumidity { get; set; }
    public long TotalRecords { get; set; }
    public long AnomalyRecords { get; set; }
}

public class LoadingOperationRequest
{
    public OperationType OperationType { get; set; }
    public string OperatorId { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? Accuracy { get; set; }
    public List<TempSnapshotDto> TemperatureSnapshots { get; set; } = new();
    public string? Remarks { get; set; }
}

public class TempSnapshotDto
{
    public string DeviceId { get; set; } = string.Empty;
    public double Temperature { get; set; }
    public double? Humidity { get; set; }
}
