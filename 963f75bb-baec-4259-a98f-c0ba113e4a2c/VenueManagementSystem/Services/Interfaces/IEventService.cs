using VenueManagementSystem.Models;

namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 活动服务接口
/// 提供活动创建、编辑、发布、取消等管理功能
/// </summary>
public interface IEventService : IServiceBase
{
    /// <summary>
    /// 异步创建活动
    /// </summary>
    /// <param name="eventDto">活动数据</param>
    /// <param name="userId">创建人ID</param>
    /// <returns>创建的活动</returns>
    Task<EventItem> CreateEventAsync(EventItem eventDto, int userId);

    /// <summary>
    /// 异步更新活动
    /// </summary>
    /// <param name="eventDto">活动数据</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>更新是否成功</returns>
    Task<bool> UpdateEventAsync(EventItem eventDto, int userId);

    /// <summary>
    /// 异步获取活动列表
    /// </summary>
    /// <param name="filter">过滤条件</param>
    /// <returns>活动列表</returns>
    Task<IEnumerable<EventItem>> GetEventsAsync(Dictionary<string, object>? filter = null);

    /// <summary>
    /// 异步根据ID获取活动
    /// </summary>
    /// <param name="id">活动ID</param>
    /// <returns>活动信息，不存在返回null</returns>
    Task<EventItem?> GetEventByIdAsync(int id);

    /// <summary>
    /// 异步删除活动
    /// </summary>
    /// <param name="id">活动ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>删除是否成功</returns>
    Task<bool> DeleteEventAsync(int id, int userId);

    /// <summary>
    /// 异步提交审批
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="userId">操作人ID</param>
    /// <returns>提交是否成功</returns>
    Task<bool> SubmitForApprovalAsync(int eventId, int userId);

    /// <summary>
    /// 验证用户是否有权限操作指定活动
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="userId">用户ID</param>
    /// <param name="permission">所需权限</param>
    /// <returns>是否有权限</returns>
    Task<bool> ValidatePermissionAsync(int eventId, int userId, string permission);
}
