namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 报表服务接口
/// 提供各类业务报表生成、导出、查询等功能
/// </summary>
public interface IReportService : IServiceBase
{
    /// <summary>
    /// 异步生成月度营收报表
    /// 支持CSV/Excel格式，使用CsvHelper导出
    /// </summary>
    /// <param name="year">年份</param>
    /// <param name="month">月份</param>
    /// <param name="format">导出格式（csv/excel）</param>
    /// <returns>报表文件字节数组</returns>
    Task<byte[]> GenerateMonthlyRevenueReportAsync(int year, int month, string format = "csv");
}
