using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Entities.ValueObjects;

namespace BloodCenter.Core.Entities;

public class CollectionSite : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public CollectionSiteType Type { get; set; }
    public Address? Address { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactPerson { get; set; }
    public bool IsActive { get; set; } = true;
    public string? OperatingHours { get; set; }

    public ICollection<Donation> Donations { get; set; } = new List<Donation>();
}
