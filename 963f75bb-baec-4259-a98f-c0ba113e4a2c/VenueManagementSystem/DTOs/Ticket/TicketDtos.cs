using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.DTOs.Ticket;

/// <summary>
/// 赛事销售数据 DTO
/// </summary>
public class TicketSalesDto
{
    /// <summary>
    /// 活动ID
    /// </summary>
    public int EventId { get; set; }

    /// <summary>
    /// 活动名称
    /// </summary>
    public string EventName { get; set; } = string.Empty;

    /// <summary>
    /// 票种销售数据列表
    /// </summary>
    public List<TicketTypeSalesDto> TicketTypeSales { get; set; } = new List<TicketTypeSalesDto>();

    /// <summary>
    /// 总销售数量
    /// </summary>
    public int TotalQuantitySold { get; set; }

    /// <summary>
    /// 总可售数量
    /// </summary>
    public int TotalQuantityAvailable { get; set; }

    /// <summary>
    /// 总销售额
    /// </summary>
    public decimal TotalRevenue { get; set; }

    /// <summary>
    /// 销售率（百分比）
    /// </summary>
    public double SalesRate { get; set; }

    /// <summary>
    /// 最后同步时间
    /// </summary>
    public DateTime LastSyncTime { get; set; }
}

/// <summary>
/// 票种销售数据 DTO
/// </summary>
public class TicketTypeSalesDto
{
    /// <summary>
    /// 票种类型
    /// </summary>
    public string TicketType { get; set; } = string.Empty;

    /// <summary>
    /// 已售出数量
    /// </summary>
    public int QuantitySold { get; set; }

    /// <summary>
    /// 可售数量
    /// </summary>
    public int QuantityAvailable { get; set; }

    /// <summary>
    /// 单价
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// 收入金额
    /// </summary>
    public decimal Revenue { get; set; }

    /// <summary>
    /// 销售率（百分比）
    /// </summary>
    public double SalesRate { get; set; }
}

/// <summary>
/// 营收统计查询参数 DTO
/// </summary>
public class RevenueQueryDto
{
    /// <summary>
    /// 场馆ID（可选）
    /// </summary>
    public int? VenueId { get; set; }

    /// <summary>
    /// 赛事类型（可选）
    /// </summary>
    public string? EventType { get; set; }

    /// <summary>
    /// 开始日期
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// 结束日期
    /// </summary>
    public DateTime? EndDate { get; set; }

    /// <summary>
    /// 统计维度：venue/eventType/date/month/year
    /// </summary>
    public string GroupBy { get; set; } = "date";
}

/// <summary>
/// 营收统计结果 DTO
/// </summary>
public class RevenueStatsDto
{
    /// <summary>
    /// 统计周期名称
    /// </summary>
    public string PeriodName { get; set; } = string.Empty;

    /// <summary>
    /// 统计开始日期
    /// </summary>
    public DateTime PeriodStart { get; set; }

    /// <summary>
    /// 统计结束日期
    /// </summary>
    public DateTime PeriodEnd { get; set; }

    /// <summary>
    /// 分组数据
    /// </summary>
    public List<RevenueGroupDto> Groups { get; set; } = new List<RevenueGroupDto>();

    /// <summary>
    /// 总营收
    /// </summary>
    public decimal TotalRevenue { get; set; }

    /// <summary>
    /// 总售票数
    /// </summary>
    public int TotalTicketsSold { get; set; }

    /// <summary>
    /// 活动数量
    /// </summary>
    public int EventCount { get; set; }

    /// <summary>
    /// 平均票价
    /// </summary>
    public decimal AverageTicketPrice { get; set; }
}

/// <summary>
/// 营收分组数据 DTO
/// </summary>
public class RevenueGroupDto
{
    /// <summary>
    /// 分组键
    /// </summary>
    public string GroupKey { get; set; } = string.Empty;

    /// <summary>
    /// 分组名称
    /// </summary>
    public string GroupName { get; set; } = string.Empty;

    /// <summary>
    /// 营收金额
    /// </summary>
    public decimal Revenue { get; set; }

    /// <summary>
    /// 售票数量
    /// </summary>
    public int TicketsSold { get; set; }

    /// <summary>
    /// 活动数量
    /// </summary>
    public int EventCount { get; set; }

    /// <summary>
    /// 占比（百分比）
    /// </summary>
    public double Percentage { get; set; }
}

/// <summary>
/// 销售预警 DTO
/// </summary>
public class TicketAlertDto
{
    /// <summary>
    /// 预警ID
    /// </summary>
    public string AlertId { get; set; } = Guid.NewGuid().ToString();

    /// <summary>
    /// 活动ID
    /// </summary>
    public int EventId { get; set; }

    /// <summary>
    /// 活动名称
    /// </summary>
    public string EventName { get; set; } = string.Empty;

    /// <summary>
    /// 预警类型
    /// </summary>
    public string AlertType { get; set; } = string.Empty;

    /// <summary>
    /// 预警级别：Low/Medium/High/Critical
    /// </summary>
    public string AlertLevel { get; set; } = string.Empty;

    /// <summary>
    /// 预警消息
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// 当前值
    /// </summary>
    public double CurrentValue { get; set; }

    /// <summary>
    /// 阈值
    /// </summary>
    public double Threshold { get; set; }

    /// <summary>
    /// 生成时间
    /// </summary>
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// 是否已读
    /// </summary>
    public bool IsRead { get; set; }
}

/// <summary>
/// 数据同步结果 DTO
/// </summary>
public class SyncResultDto
{
    /// <summary>
    /// 是否成功
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// 同步的活动数量
    /// </summary>
    public int EventsSynced { get; set; }

    /// <summary>
    /// 同步的销售记录数量
    /// </summary>
    public int SalesRecordsSynced { get; set; }

    /// <summary>
    /// 同步开始时间
    /// </summary>
    public DateTime SyncStartTime { get; set; }

    /// <summary>
    /// 同步结束时间
    /// </summary>
    public DateTime SyncEndTime { get; set; }

    /// <summary>
    /// 耗时（毫秒）
    /// </summary>
    public long DurationMs { get; set; }

    /// <summary>
    /// 错误消息（如有）
    /// </summary>
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// 报表导出查询参数 DTO
/// </summary>
public class ExportQueryDto
{
    /// <summary>
    /// 导出格式：csv/excel
    /// </summary>
    [Required]
    [RegularExpression("^(csv|excel)$", ErrorMessage = "格式只能是 csv 或 excel")]
    public string Format { get; set; } = "csv";

    /// <summary>
    /// 场馆ID（可选）
    /// </summary>
    public int? VenueId { get; set; }

    /// <summary>
    /// 赛事类型（可选）
    /// </summary>
    public string? EventType { get; set; }

    /// <summary>
    /// 开始日期
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// 结束日期
    /// </summary>
    public DateTime? EndDate { get; set; }
}
