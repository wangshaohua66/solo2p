namespace FireIoTPlatform.Models.Entities;

public class InspectionRecord : BaseEntity
{
    public long InspectionTaskId { get; set; }
    public long? DeviceId { get; set; }
    public string? DeviceCode { get; set; }
    public string? Location { get; set; }
    public DateTime CheckInTime { get; set; }
    public decimal? CheckInLatitude { get; set; }
    public decimal? CheckInLongitude { get; set; }
    public string? QrCode { get; set; }
    public string? CheckItems { get; set; }
    public string? CheckResult { get; set; }
    public bool IsNormal { get; set; } = true;
    public string? Remark { get; set; }
    public string? Photos { get; set; }
    public long InspectorId { get; set; }
    public string? InspectorName { get; set; }

    public InspectionTask? InspectionTask { get; set; }
    public Device? Device { get; set; }
}
