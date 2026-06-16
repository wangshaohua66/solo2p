namespace ColdChainLogistics.Models.DTOs;

public class ReportGenerateRequest
{
    public long? CustomerId { get; set; }
    public long? ShipmentId { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public DateTime ReportPeriodStart { get; set; }
    public DateTime ReportPeriodEnd { get; set; }
    public bool IncludeRawData { get; set; } = true;
}

public class ReportQueryRequest : PagedRequest
{
    public long? CustomerId { get; set; }
    public long? ShipmentId { get; set; }
    public string? ReportType { get; set; }
    public string? ReportNumber { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class ReportDto
{
    public long Id { get; set; }
    public string ReportNumber { get; set; } = string.Empty;
    public long? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public long? ShipmentId { get; set; }
    public string? ShipmentNumber { get; set; }
    public string ReportType { get; set; } = string.Empty;
    public DateTime ReportPeriodStart { get; set; }
    public DateTime ReportPeriodEnd { get; set; }
    public string? FileName { get; set; }
    public long FileSize { get; set; }
    public string? Status { get; set; }
    public DateTime? GeneratedAt { get; set; }
    public string? GeneratedBy { get; set; }
}

public class SlidingWindowStatsDto
{
    public long SensorId { get; set; }
    public DateTime WindowStart { get; set; }
    public DateTime WindowEnd { get; set; }
    public int DataPointCount { get; set; }
    public double MinTemperature { get; set; }
    public double MaxTemperature { get; set; }
    public double AvgTemperature { get; set; }
    public double MinHumidity { get; set; }
    public double MaxHumidity { get; set; }
    public double AvgHumidity { get; set; }
    public double TemperatureVariance { get; set; }
    public double HumidityVariance { get; set; }
    public double TemperatureVolatility { get; set; }
    public double HumidityVolatility { get; set; }
}
