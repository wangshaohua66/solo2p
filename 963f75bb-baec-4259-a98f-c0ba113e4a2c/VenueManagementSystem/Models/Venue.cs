using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 场馆实体类
/// 表示场馆的基本信息
/// </summary>
public class Venue
{
    /// <summary>
    /// 场馆唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 场馆名称
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 场馆容量
    /// </summary>
    public int Capacity { get; set; }

    /// <summary>
    /// 场馆位置
    /// </summary>
    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    /// <summary>
    /// 场馆状态
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 更新时间
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 导航属性：场馆下的资源列表
    /// </summary>
    public virtual ICollection<Resource> Resources { get; set; } = new List<Resource>();

    /// <summary>
    /// 导航属性：场馆下的活动列表
    /// </summary>
    public virtual ICollection<EventItem> Events { get; set; } = new List<EventItem>();

    /// <summary>
    /// 导航属性：场馆下的设备列表
    /// </summary>
    public virtual ICollection<Equipment> Equipments { get; set; } = new List<Equipment>();

    /// <summary>
    /// 导航属性：场馆下的应急日志列表
    /// </summary>
    public virtual ICollection<EmergencyLog> EmergencyLogs { get; set; } = new List<EmergencyLog>();
}
