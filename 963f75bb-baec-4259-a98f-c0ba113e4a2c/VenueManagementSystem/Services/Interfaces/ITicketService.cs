namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 票务服务接口
/// 提供票务管理、销售统计、营收分析等功能
/// </summary>
public interface ITicketService : IServiceBase
{
    /// <summary>
    /// 异步获取活动票务销售数据
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <returns>销售数据字典</returns>
    Task<Dictionary<string, object>> GetTicketSalesAsync(int eventId);

    /// <summary>
    /// 异步获取营收统计数据
    /// </summary>
    /// <param name="venueId">场馆ID</param>
    /// <param name="eventType">活动类型</param>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <returns>营收统计数据</returns>
    Task<Dictionary<string, object>> GetRevenueStatsAsync(int venueId, string eventType, DateTime startDate, DateTime endDate);

    /// <summary>
    /// 异步获取销售预警
    /// 检测异常销售波动
    /// </summary>
    /// <returns>预警信息列表</returns>
    Task<IEnumerable<Dictionary<string, object>>> GetSalesAlertsAsync();

    /// <summary>
    /// 异步同步票务数据
    /// 对接票务系统API拉取实时数据
    /// </summary>
    /// <returns>同步记录数</returns>
    Task<int> SyncTicketDataAsync();

    /// <summary>
    /// 异步导出生成营收报表
    /// 性能要求：<30秒
    /// </summary>
    /// <param name="startDate">开始日期</param>
    /// <param name="endDate">结束日期</param>
    /// <param name="format">导出格式（csv/excel）</param>
    /// <returns>报表文件字节数组</returns>
    Task<byte[]> ExportRevenueReportAsync(DateTime startDate, DateTime endDate, string format);
}
