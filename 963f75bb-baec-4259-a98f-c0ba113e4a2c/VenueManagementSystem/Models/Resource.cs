using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 资源实体类
/// 表示场馆内的各类资源，如舞台、座位区、设备等
/// </summary>
public class Resource
{
    /// <summary>
    /// 资源唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 所属场馆ID
    /// </summary>
    [Required]
    [ForeignKey("Venue")]
    public int VenueId { get; set; }

    /// <summary>
    /// 资源名称
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 资源类型
    /// </summary>
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// 资源容量
    /// </summary>
    public int Capacity { get; set; }

    /// <summary>
    /// 资源状态
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 转换所需时间（分钟）
    /// 表示从一种使用方式转换为另一种所需的时间
    /// </summary>
    public int ConversionTimeMinutes { get; set; }

    /// <summary>
    /// 位置X坐标
    /// 用于场馆地图定位
    /// </summary>
    public double PositionX { get; set; }

    /// <summary>
    /// 位置Y坐标
    /// 用于场馆地图定位
    /// </summary>
    public double PositionY { get; set; }

    /// <summary>
    /// 位置Z坐标
    /// 用于场馆地图定位（楼层）
    /// </summary>
    public double PositionZ { get; set; }

    /// <summary>
    /// 导航属性：所属场馆
    /// </summary>
    public virtual Venue? Venue { get; set; }

    /// <summary>
    /// 导航属性：资源的排期列表
    /// </summary>
    public virtual ICollection<ScheduleSlot> ScheduleSlots { get; set; } = new List<ScheduleSlot>();
}
