using BloodCenter.Infrastructure.Entities.ValueObjects;

namespace BloodCenter.Infrastructure.Entities;

public class Hospital : BaseEntity
{
    public string HospitalCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Address? Address { get; set; }
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public int Level { get; set; }
    public string? ApiKey { get; set; }
    public string? Notes { get; set; }

    public ICollection<BloodRequest> BloodRequests { get; set; } = new List<BloodRequest>();
}
