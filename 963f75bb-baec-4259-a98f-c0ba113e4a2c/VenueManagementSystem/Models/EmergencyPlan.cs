using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.Models;

/// <summary>
/// 应急预案实体类
/// 表示各类紧急情况的处理预案
/// </summary>
public class EmergencyPlan
{
    /// <summary>
    /// 预案唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 应急类型
    /// </summary>
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// 预案名称
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 预案描述
    /// </summary>
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// 处理步骤JSON
    /// 存储结构化的应急处理步骤
    /// </summary>
    public string StepsJson { get; set; } = string.Empty;

    /// <summary>
    /// 导航属性：预案触发的日志列表
    /// </summary>
    public virtual ICollection<EmergencyLog> EmergencyLogs { get; set; } = new List<EmergencyLog>();
}
