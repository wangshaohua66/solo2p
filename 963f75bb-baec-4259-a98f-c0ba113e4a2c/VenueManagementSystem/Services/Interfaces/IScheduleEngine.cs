using VenueManagementSystem.Models;

namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 档期引擎接口
/// 提供档期计算、冲突检测、资源分配等核心业务逻辑
/// </summary>
public interface IScheduleEngine : IServiceBase
{
    /// <summary>
    /// 异步检测排期冲突
    /// 性能要求：冲突检测 < 500ms
    /// </summary>
    /// <param name="newEvent">新活动信息</param>
    /// <param name="existingEvents">现有活动列表</param>
    /// <returns>冲突检测结果，包含冲突类型和详细信息</returns>
    Task<Dictionary<string, object>> DetectConflictsAsync(EventItem newEvent, IEnumerable<EventItem> existingEvents);

    /// <summary>
    /// 异步查找最佳排期时段
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="duration">活动时长（分钟）</param>
    /// <param name="preferredDate">首选日期</param>
    /// <param name="requiredResources">所需资源ID列表</param>
    /// <returns>最佳排期建议</returns>
    Task<ScheduleSlot?> FindOptimalSlotAsync(int venueId, int duration, DateTime preferredDate, IEnumerable<int> requiredResources);

    /// <summary>
    /// 异步生成排期建议
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="duration">活动时长（分钟）</param>
    /// <param name="conflictDate">发生冲突的日期</param>
    /// <returns>替代日期和资源置换方案列表</returns>
    Task<IEnumerable<Dictionary<string, object>>> GenerateSuggestionsAsync(int venueId, int duration, DateTime conflictDate);

    /// <summary>
    /// 异步从Redis读取排期缓存
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <returns>排期缓存数据</returns>
    Task<IEnumerable<ScheduleSlot>> GetScheduleCacheAsync(int venueId, DateTime startDate, DateTime endDate);

    /// <summary>
    /// 异步更新Redis排期缓存
    /// 覆盖未来365天数据
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <returns>更新是否成功</returns>
    Task<bool> UpdateScheduleCacheAsync(int venueId);

    /// <summary>
    /// 异步锁定排期时段
    /// 设置7天锁定窗口
    /// </summary>
    /// <param name="scheduleSlot">排期时段</param>
    /// <param name="lockDays">锁定天数</param>
    /// <returns>锁定是否成功</returns>
    Task<bool> LockScheduleAsync(ScheduleSlot scheduleSlot, int lockDays);

    /// <summary>
    /// 异步自动释放过期锁定
    /// </summary>
    /// <returns>释放的锁定数量</returns>
    Task<int> ExpireLocksAsync();
}
