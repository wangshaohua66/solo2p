namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 通知服务接口
/// 提供站内信、短信、邮件、推送等多渠道通知功能
/// 性能要求：<10秒送达全部相关岗位
/// </summary>
public interface INotificationService : IServiceBase
{
    /// <summary>
    /// 异步发送通知给指定用户
    /// </summary>
    /// <param name="userId">接收用户ID</param>
    /// <param name="title">通知标题</param>
    /// <param name="message">通知内容</param>
    /// <param name="channel">发送渠道（app/sms/email/phone）</param>
    /// <param name="priority">优先级（low/medium/high/urgent）</param>
    /// <returns>通知ID</returns>
    Task<int> SendNotificationAsync(int userId, string title, string message, string channel, string priority);

    /// <summary>
    /// 异步广播通知给指定角色的所有用户
    /// </summary>
    /// <param name="userRoles">目标角色列表</param>
    /// <param name="title">通知标题</param>
    /// <param name="message">通知内容</param>
    /// <param name="priority">优先级</param>
    /// <returns>发送成功的通知数量</returns>
    Task<int> BroadcastNotificationAsync(IEnumerable<string> userRoles, string title, string message, string priority);

    /// <summary>
    /// 异步获取通知发送状态
    /// </summary>
    /// <param name="notificationId">通知ID</param>
    /// <returns>通知状态信息</returns>
    Task<Dictionary<string, object>> GetNotificationStatusAsync(int notificationId);
}
