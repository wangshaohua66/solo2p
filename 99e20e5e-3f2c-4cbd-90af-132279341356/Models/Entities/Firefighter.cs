using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class Firefighter : BaseEntity
{
    public string EmployeeNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? IdCardNo { get; set; }
    public string? Phone { get; set; }
    public UserRole Role { get; set; } = UserRole.Firefighter;
    public long FireStationId { get; set; }
    public string? Rank { get; set; }
    public string? Specialties { get; set; }
    public DateTime? HireDate { get; set; }
    public bool IsOnDuty { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public string? AvatarUrl { get; set; }
    public string? Description { get; set; }

    public FireStation? FireStation { get; set; }
    public ICollection<DispatchFirefighter> DispatchFirefighters { get; set; } = new List<DispatchFirefighter>();
}
