namespace WaterManagement.API.DTOs;

public class WaterLevelQueryParams
{
    public string? StationId { get; set; }
    public string? StationType { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}

public class WaterLevelReadingDto
{
    public string Id { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string StationCode { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string StationType { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public double? WaterLevel { get; set; }
    public double? Inflow { get; set; }
    public double? Outflow { get; set; }
    public double? Rainfall { get; set; }
    public double? CumulativeRainfall { get; set; }
    public double? Storage { get; set; }
    public bool IsWarning { get; set; }
    public bool IsDanger { get; set; }
}

public class StationOverviewDto
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public double Longitude { get; set; }
    public double Latitude { get; set; }
    public double? CurrentWaterLevel { get; set; }
    public double? WarningLevel { get; set; }
    public double? DangerLevel { get; set; }
    public double? Inflow { get; set; }
    public double? Outflow { get; set; }
    public double? Rainfall { get; set; }
    public double? CumulativeRainfall { get; set; }
    public DateTime? LastUpdate { get; set; }
    public string Status { get; set; } = "normal";
}

public class FloodSimulationParams
{
    public string ReservoirId { get; set; } = string.Empty;
    public double CurrentWaterLevel { get; set; }
    public double InflowRate { get; set; }
    public double OutflowRate { get; set; }
    public double[]? DownstreamDistances { get; set; }
    public int SimulationHours { get; set; } = 24;
    public int TimeStepMinutes { get; set; } = 60;
}

public class FloodSimulationResult
{
    public string ReservoirId { get; set; } = string.Empty;
    public List<DateTime> Timestamps { get; set; } = new();
    public List<FloodSectionResult> Sections { get; set; } = new();
    public double ComputationTimeMs { get; set; }
}

public class FloodSectionResult
{
    public string SectionName { get; set; } = string.Empty;
    public double DistanceKm { get; set; }
    public List<double> WaterLevels { get; set; } = new();
    public double PeakLevel { get; set; }
    public DateTime PeakTime { get; set; }
}

public class WarningSummaryDto
{
    public int TotalStations { get; set; }
    public int WarningStations { get; set; }
    public int DangerStations { get; set; }
    public int NormalStations { get; set; }
    public List<StationWarningDto> Warnings { get; set; } = new();
}

public class StationWarningDto
{
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string WarningLevel { get; set; } = string.Empty;
    public double CurrentLevel { get; set; }
    public double Threshold { get; set; }
    public DateTime TriggerTime { get; set; }
}
