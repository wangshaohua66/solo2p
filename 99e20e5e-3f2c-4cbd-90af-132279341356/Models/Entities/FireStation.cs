namespace FireIoTPlatform.Models.Entities;

public class FireStation : BaseEntity
{
    public string StationCode { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string? StationChief { get; set; }
    public string? ContactPhone { get; set; }
    public int FirefighterCount { get; set; }
    public int VehicleCount { get; set; }
    public string? EquipmentInfo { get; set; }
    public string? CoverageArea { get; set; }
    public decimal CoverageRadiusKm { get; set; } = 5;
    public int Level { get; set; } = 1;
    public string? DistrictCode { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Description { get; set; }

    public ICollection<Firefighter> Firefighters { get; set; } = new List<Firefighter>();
    public ICollection<RescueDispatch> Dispatches { get; set; } = new List<RescueDispatch>();
}
