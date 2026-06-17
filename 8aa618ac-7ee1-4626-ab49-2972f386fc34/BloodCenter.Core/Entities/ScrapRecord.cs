using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Entities;

public class ScrapRecord : BaseEntity
{
    public Guid BloodProductId { get; set; }
    public ScrapReason Reason { get; set; }
    public string? DetailedReason { get; set; }
    public DateTime ScrapDate { get; set; }
    public Guid OperatorId { get; set; }
    public Guid? ApprovedById { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? DisposalMethod { get; set; }
    public string? Notes { get; set; }

    public BloodProduct? BloodProduct { get; set; }
    public User? Operator { get; set; }
    public User? ApprovedBy { get; set; }
}
