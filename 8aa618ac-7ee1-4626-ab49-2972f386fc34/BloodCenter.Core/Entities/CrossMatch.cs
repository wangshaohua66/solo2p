using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Entities;

public class CrossMatch : BaseEntity
{
    public Guid BloodRequestId { get; set; }
    public Guid BloodProductId { get; set; }
    public Guid TechnicianId { get; set; }
    public DateTime TestTime { get; set; }
    public CrossMatchResult MajorSideResult { get; set; }
    public CrossMatchResult MinorSideResult { get; set; }
    public CrossMatchResult OverallResult { get; set; }
    public string? TestMethod { get; set; }
    public string? ReagentUsed { get; set; }
    public string? IncubationTime { get; set; }
    public string? Temperature { get; set; }
    public string? Phases { get; set; }
    public string? AntiHumanGlobulin { get; set; }
    public string? Notes { get; set; }
    public bool IsReserved { get; set; }
    public DateTime? ReservedUntil { get; set; }

    public BloodRequest? BloodRequest { get; set; }
    public BloodProduct? BloodProduct { get; set; }
    public User? Technician { get; set; }
}
