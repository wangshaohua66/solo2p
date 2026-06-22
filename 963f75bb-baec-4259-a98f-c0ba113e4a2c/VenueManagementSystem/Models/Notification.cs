using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VenueManagementSystem.Models;

/// <summary>
/// 通知实体类
/// 表示发送给用户的系统通知
/// </summary>
public class Notification
{
    /// <summary>
    /// 通知唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 接收用户ID
    /// </summary>
    [Required]
    [ForeignKey("User")]
    public int UserId { get; set; }

    /// <summary>
    /// 通知类型
    /// </summary>
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// 通知标题
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 通知内容
    /// </summary>
    [MaxLength(1000)]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// 发送渠道
    /// 如：站内信、邮件、短信等
    /// </summary>
    [MaxLength(50)]
    public string Channel { get; set; } = string.Empty;

    /// <summary>
    /// 通知状态
    /// </summary>
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 发送时间
    /// </summary>
    public DateTime? SentAt { get; set; }

    /// <summary>
    /// 送达时间
    /// </summary>
    public DateTime? DeliveredAt { get; set; }

    /// <summary>
    /// 导航属性：接收用户
    /// </summary>
    public virtual User? User { get; set; }
}
