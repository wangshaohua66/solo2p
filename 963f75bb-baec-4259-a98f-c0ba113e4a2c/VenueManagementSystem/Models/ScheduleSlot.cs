using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 排期时段实体类
/// 表示活动在特定资源上的时间安排
/// </summary>
public class ScheduleSlot
{
    /// <summary>
    /// 排期唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 所属活动ID
    /// </summary>
    [ForeignKey("EventItem")]
    public int EventId { get; set; }

    /// <summary>
    /// 所属场馆ID
    /// </summary>
    [ForeignKey("Venue")]
    public int VenueId { get; set; }

    /// <summary>
    /// 占用资源ID
    /// </summary>
    [ForeignKey("Resource")]
    public int ResourceId { get; set; }

    /// <summary>
    /// 开始时间
    /// </summary>
    public DateTime StartTime { get; set; }

    /// <summary>
    /// 结束时间
    /// </summary>
    public DateTime EndTime { get; set; }

    /// <summary>
    /// 是否已锁定
    /// 用于临时预订，超时未确认会自动释放
    /// </summary>
    public bool IsLocked { get; set; }

    /// <summary>
    /// 锁定过期时间
    /// </summary>
    public DateTime? LockExpiresAt { get; set; }

    /// <summary>
    /// 导航属性：所属活动
    /// </summary>
    public virtual EventItem? EventItem { get; set; }

    /// <summary>
    /// 导航属性：所属场馆
    /// </summary>
    public virtual Venue? Venue { get; set; }

    /// <summary>
    /// 导航属性：占用的资源
    /// </summary>
    public virtual Resource? Resource { get; set; }
}
