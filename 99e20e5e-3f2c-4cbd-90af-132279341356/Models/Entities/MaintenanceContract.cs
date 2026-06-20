using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class MaintenanceContract : BaseEntity
{
    public string ContractNo { get; set; } = string.Empty;
    public long FireUnitId { get; set; }
    public long MaintenanceCompanyId { get; set; }
    public MaintenanceStatus Status { get; set; } = MaintenanceStatus.Active;
    public string ContractName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string? Scope { get; set; }
    public string? ServiceItems { get; set; }
    public decimal? ContractAmount { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public int ReminderDaysBeforeExpiry { get; set; } = 30;
    public bool ReminderSent { get; set; } = false;
    public string? Description { get; set; }
    public string? AttachmentUrl { get; set; }

    public FireUnit? FireUnit { get; set; }
    public MaintenanceCompany? MaintenanceCompany { get; set; }
    public ICollection<MaintenanceRecord> MaintenanceRecords { get; set; } = new List<MaintenanceRecord>();
}
