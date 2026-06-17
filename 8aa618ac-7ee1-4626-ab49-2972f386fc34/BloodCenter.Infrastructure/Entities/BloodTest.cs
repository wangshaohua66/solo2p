using BloodCenter.Infrastructure.Entities.Enums;

namespace BloodCenter.Infrastructure.Entities;

public class BloodTest : BaseEntity
{
    public Guid DonationId { get; set; }
    public Guid TechnicianId { get; set; }
    public Guid? SecondReviewerId { get; set; }
    public TestType TestType { get; set; }
    public TestItem TestItem { get; set; }
    public TestResult Result { get; set; } = TestResult.Pending;
    public DateTime? TestTime { get; set; }
    public DateTime? ReviewTime { get; set; }
    public string? TestMethod { get; set; }
    public string? InstrumentUsed { get; set; }
    public string? ReagentLot { get; set; }
    public decimal? QuantitativeResult { get; set; }
    public string? Unit { get; set; }
    public string? ReferenceRange { get; set; }
    public string? Notes { get; set; }
    public bool IsReReviewed { get; set; }
    public string? ReviewComment { get; set; }

    public Donation? Donation { get; set; }
    public User? Technician { get; set; }
    public User? SecondReviewer { get; set; }
}
