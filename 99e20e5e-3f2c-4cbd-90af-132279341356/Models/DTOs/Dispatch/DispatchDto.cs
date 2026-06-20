using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.Dispatch;

public class RescueDispatchDto
{
    public long Id { get; set; }
    public string DispatchNo { get; set; } = string.Empty;
    public long? AlarmId { get; set; }
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public long FireStationId { get; set; }
    public string? FireStationName { get; set; }
    public DispatchStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? FireType { get; set; }
    public string? FireLevel { get; set; }
    public string Location { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public DateTime DispatchTime { get; set; }
    public DateTime? DepartureTime { get; set; }
    public DateTime? ArrivalTime { get; set; }
    public DateTime? ResolveTime { get; set; }
    public string? DispatcherName { get; set; }
    public string? CommanderName { get; set; }
    public int EstimatedArrivalMinutes { get; set; }
    public string? BuildingInfo { get; set; }
    public string? FacilityDistribution { get; set; }
    public string? HazardousMaterials { get; set; }
    public string? NearbyWaterSources { get; set; }
    public string? RoadCondition { get; set; }
    public string? LiveVideoUrl { get; set; }
    public string? RescueSummary { get; set; }
    public int Casualties { get; set; }
    public int Injuries { get; set; }
    public List<DispatchFirefighterDto> Firefighters { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class DispatchFirefighterDto
{
    public long FirefighterId { get; set; }
    public string? FirefighterName { get; set; }
    public string? Role { get; set; }
    public DateTime AssignedAt { get; set; }
}

public class DispatchCreateDto
{
    public long? AlarmId { get; set; }
    public long FireUnitId { get; set; }
    public long? FireStationId { get; set; }
    public string? FireType { get; set; }
    public string? FireLevel { get; set; }
    public string Location { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public long DispatcherId { get; set; }
    public List<long>? FirefighterIds { get; set; }
    public string? DispatchRemark { get; set; }
}

public class DispatchQueryDto : PagedQuery
{
    public DispatchStatus? Status { get; set; }
    public long? FireStationId { get; set; }
    public long? FireUnitId { get; set; }
    public string? DistrictCode { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class DispatchStatusUpdateDto
{
    public long DispatchId { get; set; }
    public DispatchStatus Status { get; set; }
    public string? Remark { get; set; }
    public long OperatorId { get; set; }
}

public class DispatchReportDto
{
    public long DispatchId { get; set; }
    public string OnSceneReport { get; set; } = string.Empty;
    public string? RescueSummary { get; set; }
    public int Casualties { get; set; }
    public int Injuries { get; set; }
    public decimal? FireArea { get; set; }
    public decimal? EstimatedLoss { get; set; }
    public long OperatorId { get; set; }
}

public class NearbyStationDto
{
    public long FireStationId { get; set; }
    public string StationName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal DistanceKm { get; set; }
    public int EstimatedArrivalMinutes { get; set; }
    public int FirefighterOnDutyCount { get; set; }
    public int AvailableVehicleCount { get; set; }
}

public class FireStationDto
{
    public long Id { get; set; }
    public string StationCode { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string? StationChief { get; set; }
    public string? ContactPhone { get; set; }
    public int FirefighterCount { get; set; }
    public int VehicleCount { get; set; }
    public decimal CoverageRadiusKm { get; set; }
    public bool IsActive { get; set; }
}

public class FirefighterDto
{
    public long Id { get; set; }
    public string EmployeeNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public UserRole Role { get; set; }
    public long FireStationId { get; set; }
    public string? FireStationName { get; set; }
    public string? Rank { get; set; }
    public string? Specialties { get; set; }
    public bool IsOnDuty { get; set; }
}
