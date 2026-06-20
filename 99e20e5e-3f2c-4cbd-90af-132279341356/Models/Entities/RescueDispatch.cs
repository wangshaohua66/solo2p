using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class RescueDispatch : BaseEntity
{
    public string DispatchNo { get; set; } = string.Empty;
    public long? AlarmId { get; set; }
    public long FireUnitId { get; set; }
    public long FireStationId { get; set; }
    public DispatchStatus Status { get; set; } = DispatchStatus.Created;
    public string? FireType { get; set; }
    public string? FireLevel { get; set; }
    public string Location { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public DateTime DispatchTime { get; set; }
    public DateTime? DepartureTime { get; set; }
    public DateTime? ArrivalTime { get; set; }
    public DateTime? ResolveTime { get; set; }
    public DateTime? ReturnTime { get; set; }
    public long? DispatcherId { get; set; }
    public string? DispatcherName { get; set; }
    public long? CommanderId { get; set; }
    public string? CommanderName { get; set; }
    public int EstimatedArrivalMinutes { get; set; }
    public string? BuildingInfo { get; set; }
    public string? FacilityDistribution { get; set; }
    public string? HazardousMaterials { get; set; }
    public string? NearbyWaterSources { get; set; }
    public string? RoadCondition { get; set; }
    public string? LiveVideoUrl { get; set; }
    public string? DispatchRemark { get; set; }
    public string? OnSceneReport { get; set; }
    public string? RescueSummary { get; set; }
    public int Casualties { get; set; } = 0;
    public int Injuries { get; set; } = 0;
    public decimal? FireArea { get; set; }
    public decimal? EstimatedLoss { get; set; }

    public AlarmRecord? Alarm { get; set; }
    public FireUnit? FireUnit { get; set; }
    public FireStation? FireStation { get; set; }
    public ICollection<DispatchFirefighter> DispatchFirefighters { get; set; } = new List<DispatchFirefighter>();
}
