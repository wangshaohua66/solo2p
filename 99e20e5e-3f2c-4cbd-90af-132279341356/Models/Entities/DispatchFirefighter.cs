namespace FireIoTPlatform.Models.Entities;

public class DispatchFirefighter
{
    public long Id { get; set; }
    public long DispatchId { get; set; }
    public long FirefighterId { get; set; }
    public string? Role { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.Now;
    public DateTime? ArrivedAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string? Remark { get; set; }

    public RescueDispatch? Dispatch { get; set; }
    public Firefighter? Firefighter { get; set; }
}
