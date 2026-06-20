using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class FireUnit : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? UnifiedSocialCreditCode { get; set; }
    public UnitType UnitType { get; set; }
    public string Address { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? LegalPerson { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public int? BuildingArea { get; set; }
    public int? FloorCount { get; set; }
    public int? BasementCount { get; set; }
    public string? BuildingStructure { get; set; }
    public string? FireSafetyManager { get; set; }
    public string? FireSafetyManagerPhone { get; set; }
    public string? FloorPlanUrl { get; set; }
    public string? HazardousMaterials { get; set; }
    public string? Description { get; set; }
    public string? DistrictCode { get; set; }
    public string? DistrictName { get; set; }
    public bool IsKeyUnit { get; set; } = true;
    public int Level { get; set; } = 1;

    public ICollection<Device> Devices { get; set; } = new List<Device>();
    public ICollection<InspectionTask> InspectionTasks { get; set; } = new List<InspectionTask>();
    public ICollection<MaintenanceContract> MaintenanceContracts { get; set; } = new List<MaintenanceContract>();
    public ICollection<AlarmRecord> AlarmRecords { get; set; } = new List<AlarmRecord>();
}
