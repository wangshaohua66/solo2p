namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// Redis 发布者接口
/// 提供基于 Redis 订阅/发布模式的消息推送功能
/// </summary>
public interface IRedisPublisher : IServiceBase
{
    /// <summary>
    /// 异步发布排期更新消息
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="eventData">排期事件数据</param>
    /// <returns>发布是否成功</returns>
    Task<bool> PublishScheduleUpdateAsync(int venueId, object eventData);

    /// <summary>
    /// 异步发布应急更新消息
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="eventData">应急事件数据</param>
    /// <returns>发布是否成功</returns>
    Task<bool> PublishEmergencyUpdateAsync(int logId, object eventData);

    /// <summary>
    /// 异步发布资源状态更新消息
    /// </summary>
    /// <param name="resourceId">资源ID</param>
    /// <param name="status">资源状态</param>
    /// <returns>发布是否成功</returns>
    Task<bool> PublishResourceStatusAsync(int resourceId, string status);
}
