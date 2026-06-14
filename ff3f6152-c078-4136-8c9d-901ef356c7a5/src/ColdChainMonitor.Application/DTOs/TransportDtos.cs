using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.DTOs;

public class CreateTransportTaskRequest
{
    public string DrugBatchNo { get; set; } = string.Empty;
    public string DrugName { get; set; } = string.Empty;
    public string DrugType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = "箱";
    public string? Manufacturer { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? ExpiryDate { get; set; }

    public string VehicleId { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string? VehicleType { get; set; }

    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string? DriverPhone { get; set; }

    public string OriginName { get; set; } = string.Empty;
    public string OriginAddress { get; set; } = string.Empty;
    public string? OriginContact { get; set; }
    public string? OriginPhone { get; set; }

    public string DestinationName { get; set; } = string.Empty;
    public string DestinationAddress { get; set; } = string.Empty;
    public string? DestinationContact { get; set; }
    public string? DestinationPhone { get; set; }

    public List<string> DeviceIds { get; set; } = new();

    public double MinTemp { get; set; } = 2.0;
    public double MaxTemp { get; set; } = 8.0;
    public double? MinHumidity { get; set; }
    public double? MaxHumidity { get; set; }

    public DateTime PlannedDepartureAt { get; set; }
    public DateTime PlannedArrivalAt { get; set; }
}

public class UpdateTransportTaskRequest
{
    public string? VehicleId { get; set; }
    public string? PlateNumber { get; set; }
    public string? DriverId { get; set; }
    public string? DriverName { get; set; }
    public List<string>? DeviceIds { get; set; }
    public DateTime? PlannedDepartureAt { get; set; }
    public DateTime? PlannedArrivalAt { get; set; }
    public double? MinTemp { get; set; }
    public double? MaxTemp { get; set; }
}

public class TransportTaskStatusRequest
{
    public string Remarks { get; set; } = string.Empty;
}

public class TransportTaskDto
{
    public string Id { get; set; } = string.Empty;
    public string TaskNo { get; set; } = string.Empty;
    public TransportStatus Status { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public DrugBatchDto DrugBatch { get; set; } = new();
    public VehicleDto Vehicle { get; set; } = new();
    public DriverDto Driver { get; set; } = new();
    public LocationDto Origin { get; set; } = new();
    public LocationDto Destination { get; set; } = new();
    public List<string> DeviceIds { get; set; } = new();
    public TemperatureRangeDto TemperatureRange { get; set; } = new();
    public DateTime PlannedDepartureAt { get; set; }
    public DateTime PlannedArrivalAt { get; set; }
    public DateTime? ActualDepartureAt { get; set; }
    public DateTime? ActualArrivalAt { get; set; }
    public int AlertCount { get; set; }
    public int CriticalAlertCount { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class DrugBatchDto
{
    public string BatchNo { get; set; } = string.Empty;
    public string DrugName { get; set; } = string.Empty;
    public string DrugType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = "箱";
    public string? Manufacturer { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
}

public class VehicleDto
{
    public string VehicleId { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string? VehicleType { get; set; }
}

public class DriverDto
{
    public string DriverId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string? Phone { get; set; }
}

public class LocationDto
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Contact { get; set; }
    public string? Phone { get; set; }
}

public class TemperatureRangeDto
{
    public double MinTemp { get; set; }
    public double MaxTemp { get; set; }
    public double? MinHumidity { get; set; }
    public double? MaxHumidity { get; set; }
}

public class TransportTaskQueryRequest : CursorPagedQuery
{
    public TransportStatus? Status { get; set; }
    public string? Keyword { get; set; }
    public string? VehicleId { get; set; }
    public string? DriverId { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}
