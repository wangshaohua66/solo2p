using FireIoTPlatform.Models.Enums;

namespace FireIoTPlatform.Models.Entities;

public class DeviceData
{
    public long Id { get; set; }
    public long DeviceId { get; set; }
    public long FireUnitId { get; set; }
    public DeviceType DeviceType { get; set; }
    public decimal? Value { get; set; }
    public string? RawData { get; set; }
    public DeviceStatus Status { get; set; }
    public DateTime Timestamp { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public int Day { get; set; }
    public int Hour { get; set; }

    public Device? Device { get; set; }
}
