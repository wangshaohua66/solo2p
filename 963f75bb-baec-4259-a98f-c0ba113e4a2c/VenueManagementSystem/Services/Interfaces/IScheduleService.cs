using VenueManagementSystem.Models;

namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 档期服务接口
/// 提供档期查询、创建、更新、冲突检测等功能
/// </summary>
public interface IScheduleService : IServiceBase
{
    /// <summary>
    /// 异步获取场馆排期列表
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <returns>排期列表</returns>
    Task<IEnumerable<ScheduleSlot>> GetSchedulesAsync(int venueId, DateTime startDate, DateTime endDate);

    /// <summary>
    /// 异步创建排期
    /// </summary>
    /// <param name="schedule">排期信息</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>创建的排期</returns>
    Task<ScheduleSlot> CreateScheduleAsync(ScheduleSlot schedule, int userId);

    /// <summary>
    /// 异步更新排期
    /// </summary>
    /// <param name="schedule">排期信息</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>更新是否成功</returns>
    Task<bool> UpdateScheduleAsync(ScheduleSlot schedule, int userId);

    /// <summary>
    /// 异步删除排期
    /// </summary>
    /// <param name="id">排期ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>删除是否成功</returns>
    Task<bool> DeleteScheduleAsync(int id, int userId);

    /// <summary>
    /// 异步确认排期
    /// </summary>
    /// <param name="id">排期ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>确认是否成功</returns>
    Task<bool> ConfirmScheduleAsync(int id, int userId);

    /// <summary>
    /// 异步检测排期冲突
    /// </summary>
    /// <param name="schedule">待检测排期</param>
    /// <returns>冲突检测结果</returns>
    Task<Dictionary<string, object>> CheckConflictsAsync(ScheduleSlot schedule);

    /// <summary>
    /// 异步发布排期变更消息
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="eventData">变更数据</param>
    /// <returns>发布是否成功</returns>
    Task<bool> PublishScheduleUpdateAsync(int venueId, object eventData);
}
