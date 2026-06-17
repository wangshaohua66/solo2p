using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Entities;

public class InitialScreening : BaseEntity
{
    public Guid DonationId { get; set; }
    public Guid TechnicianId { get; set; }
    public DateTime ScreeningTime { get; set; }
    public BloodType BloodType { get; set; }
    public RhFactor RhFactor { get; set; }
    public decimal Hemoglobin { get; set; }
    public decimal ALT { get; set; }
    public TestResult HBsAg { get; set; }
    public bool Passed { get; set; }
    public string? FailureReason { get; set; }
    public string? Notes { get; set; }

    public Donation? Donation { get; set; }
    public User? Technician { get; set; }
}
