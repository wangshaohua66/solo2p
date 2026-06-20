using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.DTOs.Unit;

public class FireUnitDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? UnifiedSocialCreditCode { get; set; }
    public UnitType UnitType { get; set; }
    public string UnitTypeName { get; set; } = string.Empty;
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
    public string? FireSafetyManager { get; set; }
    public string? FireSafetyManagerPhone { get; set; }
    public string? FloorPlanUrl { get; set; }
    public string? HazardousMaterials { get; set; }
    public string? Description { get; set; }
    public string? DistrictCode { get; set; }
    public string? DistrictName { get; set; }
    public bool IsKeyUnit { get; set; }
    public int Level { get; set; }
    public int DeviceCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FireUnitCreateDto
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
}

public class FireUnitQueryDto : PagedQuery
{
    public UnitType? UnitType { get; set; }
    public string? DistrictCode { get; set; }
    public bool? IsKeyUnit { get; set; }
    public int? Level { get; set; }
}

public class WaterSystemStatusDto
{
    public long FireUnitId { get; set; }
    public string? FireUnitName { get; set; }
    public int PoolLevelMonitorCount { get; set; }
    public int PressureMonitorCount { get; set; }
    public int HydrantMonitorCount { get; set; }
    public int AbnormalCount { get; set; }
    public List<WaterSystemDeviceDto> Devices { get; set; } = new();
}

public class WaterSystemDeviceDto
{
    public long DeviceId { get; set; }
    public string DeviceCode { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public DeviceType DeviceType { get; set; }
    public decimal? CurrentValue { get; set; }
    public decimal? WarningThresholdLow { get; set; }
    public decimal? WarningThresholdHigh { get; set; }
    public decimal? CriticalThresholdLow { get; set; }
    public decimal? CriticalThresholdHigh { get; set; }
    public DeviceStatus Status { get; set; }
    public string? Location { get; set; }
    public DateTime? LastUpdateAt { get; set; }
}
