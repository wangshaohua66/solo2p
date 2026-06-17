using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Entities;

public class InventorySetting : BaseEntity
{
    public BloodProductType ProductType { get; set; }
    public BloodType BloodType { get; set; }
    public RhFactor RhFactor { get; set; }
    public int MinimumLevel { get; set; }
    public int WarningLevel { get; set; }
    public int EmergencyReserve { get; set; }
    public string? Notes { get; set; }
}
