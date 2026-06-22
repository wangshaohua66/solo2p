using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.DTOs.Venue;

/// <summary>
/// 场馆统计数据 DTO
/// </summary>
public class VenueStatsDto
{
    /// <summary>
    /// 场馆ID
    /// </summary>
    public int VenueId { get; set; }

    /// <summary>
    /// 场馆名称
    /// </summary>
    public string VenueName { get; set; } = string.Empty;

    /// <summary>
    /// 总活动数
    /// </summary>
    public int TotalEvents { get; set; }

    /// <summary>
    /// 本月活动数
    /// </summary>
    public int ThisMonthEvents { get; set; }

    /// <summary>
    /// 总资源数
    /// </summary>
    public int TotalResources { get; set; }

    /// <summary>
    /// 可用资源数
    /// </summary>
    public int AvailableResources { get; set; }

    /// <summary>
    /// 设备总数
    /// </summary>
    public int TotalEquipments { get; set; }

    /// <summary>
    /// 正常运行设备数
    /// </summary>
    public int ActiveEquipments { get; set; }

    /// <summary>
    /// 累计收入
    /// </summary>
    public decimal TotalRevenue { get; set; }

    /// <summary>
    /// 本月收入
    /// </summary>
    public decimal ThisMonthRevenue { get; set; }

    /// <summary>
    /// 平均上座率
    /// </summary>
    public double AverageOccupancyRate { get; set; }
}

/// <summary>
/// 更新资源位置请求 DTO
/// </summary>
public class UpdateResourcePositionDto
{
    /// <summary>
    /// 位置X坐标
    /// </summary>
    [Required]
    public double PositionX { get; set; }

    /// <summary>
    /// 位置Y坐标
    /// </summary>
    [Required]
    public double PositionY { get; set; }

    /// <summary>
    /// 位置Z坐标（楼层）
    /// </summary>
    public double PositionZ { get; set; }
}

/// <summary>
/// 切换设备模式请求 DTO
/// </summary>
public class ChangeEquipmentModeDto
{
    /// <summary>
    /// 目标模式：sports/concert
    /// </summary>
    [Required]
    [RegularExpression("^(sports|concert)$", ErrorMessage = "模式只能是 sports 或 concert")]
    public string Mode { get; set; } = string.Empty;
}

/// <summary>
/// 场馆档期查询参数 DTO
/// </summary>
public class VenueScheduleQueryDto
{
    /// <summary>
    /// 开始日期
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// 结束日期
    /// </summary>
    public DateTime? EndDate { get; set; }

    /// <summary>
    /// 资源类型
    /// </summary>
    public string? ResourceType { get; set; }

    /// <summary>
    /// 是否只显示已确认
    /// </summary>
    public bool? OnlyConfirmed { get; set; }
}
