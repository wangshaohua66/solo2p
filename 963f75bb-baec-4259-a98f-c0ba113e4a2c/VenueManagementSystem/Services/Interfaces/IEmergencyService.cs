using VenueManagementSystem.Models;

namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 紧急事件服务接口
/// 提供紧急事件上报、处理、跟踪、通知等功能
/// </summary>
public interface IEmergencyService : IServiceBase
{
    /// <summary>
    /// 异步获取所有应急预案
    /// </summary>
    /// <returns>预案列表</returns>
    Task<IEnumerable<EmergencyPlan>> GetEmergencyPlansAsync();

    /// <summary>
    /// 异步触发应急预案
    /// 触发后自动调用NotificationService推送通知
    /// </summary>
    /// <param name="planId">预案ID</param>
    /// <param name="venueId">场馆ID</param>
    /// <param name="triggeredBy">触发人ID</param>
    /// <param name="remarks">触发备注</param>
    /// <returns>应急日志ID</returns>
    Task<int> TriggerEmergencyAsync(int planId, int venueId, int triggeredBy, string remarks);

    /// <summary>
    /// 异步完成应急步骤
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="stepId">步骤ID</param>
    /// <param name="completedBy">完成人ID</param>
    /// <param name="remarks">完成备注</param>
    /// <returns>完成是否成功</returns>
    Task<bool> CompleteStepAsync(int logId, int stepId, int completedBy, string remarks);

    /// <summary>
    /// 异步解除应急状态
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="resolvedBy">解除人ID</param>
    /// <param name="resolution">解决方案</param>
    /// <returns>解除是否成功</returns>
    Task<bool> ResolveEmergencyAsync(int logId, int resolvedBy, string resolution);

    /// <summary>
    /// 异步生成处置复盘报告
    /// 支持PDF/Word格式
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <returns>报告文件字节数组</returns>
    Task<byte[]> GenerateReportAsync(int logId);

    /// <summary>
    /// 异步获取当前活跃的应急事件
    /// </summary>
    /// <returns>活跃应急日志列表</returns>
    Task<IEnumerable<EmergencyLog>> GetActiveEmergencyAsync();

    /// <summary>
    /// 异步获取应急日志列表
    /// </summary>
    /// <param name="filter">过滤条件</param>
    /// <returns>应急日志列表</returns>
    Task<IEnumerable<EmergencyLog>> GetEmergencyLogsAsync(Dictionary<string, object>? filter = null);
}
