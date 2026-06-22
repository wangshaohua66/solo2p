using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 活动实体类
/// 表示在场馆举办的各类活动
/// </summary>
public class EventItem
{
    /// <summary>
    /// 活动唯一标识
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
    /// 活动名称
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 活动类型
    /// </summary>
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// 活动描述
    /// </summary>
    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// 活动开始日期
    /// </summary>
    public DateTime StartDate { get; set; }

    /// <summary>
    /// 活动结束日期
    /// </summary>
    public DateTime EndDate { get; set; }

    /// <summary>
    /// 预期收入
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal ExpectedRevenue { get; set; }

    /// <summary>
    /// 活动状态
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 创建人
    /// </summary>
    [MaxLength(100)]
    public string CreatedBy { get; set; } = string.Empty;

    /// <summary>
    /// 导航属性：所属场馆
    /// </summary>
    public virtual Venue? Venue { get; set; }

    /// <summary>
    /// 导航属性：活动的排期列表
    /// </summary>
    public virtual ICollection<ScheduleSlot> ScheduleSlots { get; set; } = new List<ScheduleSlot>();

    /// <summary>
    /// 导航属性：活动的票务销售记录
    /// </summary>
    public virtual ICollection<TicketSales> TicketSales { get; set; } = new List<TicketSales>();

    /// <summary>
    /// 导航属性：活动的审批步骤列表
    /// </summary>
    public virtual ICollection<ApprovalStep> ApprovalSteps { get; set; } = new List<ApprovalStep>();
}
