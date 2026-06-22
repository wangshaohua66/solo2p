using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 应急日志实体类
/// 记录应急预案的触发和处理情况
/// </summary>
public class EmergencyLog
{
    /// <summary>
    /// 日志唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 关联的预案ID
    /// </summary>
    [Required]
    [ForeignKey("EmergencyPlan")]
    public int PlanId { get; set; }

    /// <summary>
    /// 所属场馆ID
    /// </summary>
    [ForeignKey("Venue")]
    public int VenueId { get; set; }

    /// <summary>
    /// 状态
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 触发时间
    /// </summary>
    public DateTime TriggeredAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 解决时间
    /// </summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>
    /// 详细信息JSON
    /// 存储应急处理过程中的详细信息
    /// </summary>
    public string DetailsJson { get; set; } = string.Empty;

    /// <summary>
    /// 报告链接
    /// 指向完整的应急处理报告
    /// </summary>
    [MaxLength(200)]
    public string ReportUrl { get; set; } = string.Empty;

    /// <summary>
    /// 导航属性：关联的预案
    /// </summary>
    public virtual EmergencyPlan? EmergencyPlan { get; set; }

    /// <summary>
    /// 导航属性：所属场馆
    /// </summary>
    public virtual Venue? Venue { get; set; }
}
