using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 审批步骤实体类
/// 表示活动审批流程中的每个步骤
/// </summary>
public class ApprovalStep
{
    /// <summary>
    /// 审批步骤唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 所属活动ID
    /// </summary>
    [Required]
    [ForeignKey("EventItem")]
    public int EventId { get; set; }

    /// <summary>
    /// 步骤名称
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string StepName { get; set; } = string.Empty;

    /// <summary>
    /// 分配给
    /// 指审批人的用户名或ID
    /// </summary>
    [MaxLength(100)]
    public string AssignedTo { get; set; } = string.Empty;

    /// <summary>
    /// 审批状态
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 审批意见
    /// </summary>
    [MaxLength(500)]
    public string Comments { get; set; } = string.Empty;

    /// <summary>
    /// 截止日期
    /// </summary>
    public DateTime DueDate { get; set; }

    /// <summary>
    /// 完成时间
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// 导航属性：所属活动
    /// </summary>
    public virtual EventItem? EventItem { get; set; }
}
