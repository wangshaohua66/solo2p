namespace ColdChainLogistics.Models.DTOs;

public class ShipmentCreateRequest
{
    public long CustomerId { get; set; }
    public long VehicleId { get; set; }
    public long OriginWarehouseId { get; set; }
    public string? Destination { get; set; }
    public string? RouteCode { get; set; }
    public string? DriverName { get; set; }
    public string? DriverPhone { get; set; }
    public string? Remarks { get; set; }
    public double? TemperatureMin { get; set; }
    public double? TemperatureMax { get; set; }
    public double? HumidityMin { get; set; }
    public double? HumidityMax { get; set; }
    public List<ShipmentBatchCreateDto>? Batches { get; set; }
}

public class ShipmentBatchCreateDto
{
    public string BatchNumber { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? ProductCategory { get; set; }
    public int Quantity { get; set; }
    public string? Unit { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? StorageCondition { get; set; }
    public double? TemperatureRequirementMin { get; set; }
    public double? TemperatureRequirementMax { get; set; }
}

public class ShipmentUpdateRequest
{
    public long Id { get; set; }
    public string? Destination { get; set; }
    public string? RouteCode { get; set; }
    public string? DriverName { get; set; }
    public string? DriverPhone { get; set; }
    public string? Remarks { get; set; }
    public double? TemperatureMin { get; set; }
    public double? TemperatureMax { get; set; }
}

public class ShipmentStatusUpdateRequest
{
    public long Id { get; set; }
    public int Status { get; set; }
    public string? Remark { get; set; }
}

public class ShipmentQueryRequest : PagedRequest
{
    public long? CustomerId { get; set; }
    public long? VehicleId { get; set; }
    public int? Status { get; set; }
    public string? ShipmentNumber { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class ShipmentDto
{
    public long Id { get; set; }
    public string ShipmentNumber { get; set; } = string.Empty;
    public long CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public long VehicleId { get; set; }
    public string VehicleNumber { get; set; } = string.Empty;
    public long OriginWarehouseId { get; set; }
    public string OriginWarehouseName { get; set; } = string.Empty;
    public string? Destination { get; set; }
    public string? RouteCode { get; set; }
    public int Status { get; set; }
    public string StatusText { get; set; } = string.Empty;
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
    public DateTime CreatedAt { get; set; }
    public List<ShipmentBatchDto>? Batches { get; set; }
}

public class ShipmentBatchDto
{
    public long Id { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? ProductCategory { get; set; }
    public int Quantity { get; set; }
    public string? Unit { get; set; }
    public DateTime? ProductionDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
}
