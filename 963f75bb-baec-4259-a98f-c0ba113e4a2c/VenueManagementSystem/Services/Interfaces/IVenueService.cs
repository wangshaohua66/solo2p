using VenueManagementSystem.Models;

namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 场馆服务接口
/// 提供场馆信息管理、查询、维护等功能
/// </summary>
public interface IVenueService : IServiceBase
{
    /// <summary>
    /// 异步获取所有场馆列表
    /// </summary>
    /// <returns>场馆列表</returns>
    Task<IEnumerable<Venue>> GetVenuesAsync();

    /// <summary>
    /// 异步根据ID获取场馆信息
    /// </summary>
    /// <param name="id">场馆ID</param>
    /// <returns>场馆信息，不存在返回null</returns>
    Task<Venue?> GetVenueByIdAsync(int id);

    /// <summary>
    /// 异步获取场馆下的所有资源
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <returns>资源列表</returns>
    Task<IEnumerable<Resource>> GetResourcesByVenueAsync(int venueId);

    /// <summary>
    /// 异步获取指定资源信息
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="resourceId">资源ID</param>
    /// <returns>资源信息，不存在返回null</returns>
    Task<Resource?> GetResourceByIdAsync(int venueId, int resourceId);

    /// <summary>
    /// 异步更新资源位置坐标
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="resourceId">资源ID</param>
    /// <param name="x">X坐标</param>
    /// <param name="y">Y坐标</param>
    /// <param name="z">Z坐标（楼层）</param>
    /// <returns>更新是否成功</returns>
    Task<bool> UpdateResourcePositionAsync(int venueId, int resourceId, double x, double y, double z);

    /// <summary>
    /// 异步获取场馆统计数据
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="startDate">统计开始日期</param>
    /// <param name="endDate">统计结束日期</param>
    /// <returns>统计数据字典</returns>
    Task<Dictionary<string, object>> GetVenueStatsAsync(int venueId, DateTime startDate, DateTime endDate);

    /// <summary>
    /// 异步获取场馆设备列表
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <returns>设备列表</returns>
    Task<IEnumerable<Equipment>> GetEquipmentByVenueAsync(int venueId);

    /// <summary>
    /// 异步设置场馆设备运行模式
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="mode">设备模式</param>
    /// <returns>设置是否成功</returns>
    Task<bool> SetEquipmentModeAsync(int venueId, string mode);

    /// <summary>
    /// 异步锁定资源
    /// </summary>
    /// <param name="resourceId">资源ID</param>
    /// <param name="eventId">关联活动ID</param>
    /// <param name="duration">锁定时长（分钟）</param>
    /// <returns>锁定是否成功</returns>
    Task<bool> LockResourceAsync(int resourceId, int eventId, int duration);

    /// <summary>
    /// 异步解锁资源
    /// </summary>
    /// <param name="resourceId">资源ID</param>
    /// <returns>解锁是否成功</returns>
    Task<bool> UnlockResourceAsync(int resourceId);
}
