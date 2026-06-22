using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 设备实体类
/// 表示场馆内的各类设备
/// </summary>
public class Equipment
{
    /// <summary>
    /// 设备唯一标识
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
    /// 设备名称
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 设备类型
    /// </summary>
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// 设备型号
    /// </summary>
    [MaxLength(100)]
    public string Model { get; set; } = string.Empty;

    /// <summary>
    /// 设备状态
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 模式兼容性
    /// 描述设备支持的运行模式
    /// </summary>
    [MaxLength(200)]
    public string ModeCompatibility { get; set; } = string.Empty;

    /// <summary>
    /// 存放位置
    /// </summary>
    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    /// <summary>
    /// 上次维护时间
    /// </summary>
    public DateTime LastMaintenance { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 导航属性：所属场馆
    /// </summary>
    public virtual Venue? Venue { get; set; }
}
