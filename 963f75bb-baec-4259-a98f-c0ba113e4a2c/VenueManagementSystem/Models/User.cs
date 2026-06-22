using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.Models;

/// <summary>
/// 用户实体类
/// 表示系统用户信息
/// </summary>
public class User
{
    /// <summary>
    /// 用户唯一标识
    /// </summary>
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// 用户名
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// 用户角色
    /// </summary>
    [MaxLength(50)]
    public string Role { get; set; } = string.Empty;

    /// <summary>
    /// 密码哈希值
    /// 存储加密后的密码
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// 全名
    /// </summary>
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// 邮箱
    /// </summary>
    [MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// 电话
    /// </summary>
    [MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    /// <summary>
    /// 最后登录时间
    /// </summary>
    public DateTime? LastLoginAt { get; set; }

    /// <summary>
    /// 是否启用
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// 导航属性：用户的通知列表
    /// </summary>
    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
