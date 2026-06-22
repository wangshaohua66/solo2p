using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 票务销售实体类
/// 记录活动的票务销售信息
/// </summary>
public class TicketSales
{
    /// <summary>
    /// 销售记录唯一标识
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
    /// 票种类型
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string TicketType { get; set; } = string.Empty;

    /// <summary>
    /// 已售出数量
    /// </summary>
    public int QuantitySold { get; set; }

    /// <summary>
    /// 可售数量
    /// </summary>
    public int QuantityAvailable { get; set; }

    /// <summary>
    /// 单价
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }

    /// <summary>
    /// 收入金额
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal Revenue { get; set; }

    /// <summary>
    /// 最后更新时间
    /// </summary>
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 导航属性：所属活动
    /// </summary>
    public virtual EventItem? EventItem { get; set; }
}
