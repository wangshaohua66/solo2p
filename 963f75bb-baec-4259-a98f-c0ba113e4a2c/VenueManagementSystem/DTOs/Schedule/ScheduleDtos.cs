using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.DTOs.Schedule;

/// <summary>
/// 档期冲突检测请求 DTO
/// </summary>
public class CheckConflictDto
{
    /// <summary>
    /// 场馆ID
    /// </summary>
    [Required]
    public int VenueId { get; set; }

    /// <summary>
    /// 资源ID（可选，为空则检测所有资源）
    /// </summary>
    public int? ResourceId { get; set; }

    /// <summary>
    /// 开始时间
    /// </summary>
    [Required]
    public DateTime StartTime { get; set; }

    /// <summary>
    /// 结束时间
    /// </summary>
    [Required]
    public DateTime EndTime { get; set; }

    /// <summary>
    /// 排除的活动ID（用于更新时排除自身）
    /// </summary>
    public int? ExcludeEventId { get; set; }
}

/// <summary>
/// 档期冲突检测结果 DTO
/// </summary>
public class ConflictResultDto
{
    /// <summary>
    /// 是否存在冲突
    /// </summary>
    public bool HasConflict { get; set; }

    /// <summary>
    /// 冲突详情列表
    /// </summary>
    public List<ConflictDetailDto> Conflicts { get; set; } = new List<ConflictDetailDto>();

    /// <summary>
    /// 冲突数量
    /// </summary>
    public int ConflictCount => Conflicts.Count;
}

/// <summary>
/// 冲突详情 DTO
/// </summary>
public class ConflictDetailDto
{
    /// <summary>
    /// 资源ID
    /// </summary>
    public int ResourceId { get; set; }

    /// <summary>
    /// 资源名称
    /// </summary>
    public string ResourceName { get; set; } = string.Empty;

    /// <summary>
    /// 冲突的活动ID
    /// </summary>
    public int EventId { get; set; }

    /// <summary>
    /// 冲突的活动名称
    /// </summary>
    public string EventName { get; set; } = string.Empty;

    /// <summary>
    /// 冲突开始时间
    /// </summary>
    public DateTime ConflictStartTime { get; set; }

    /// <summary>
    /// 冲突结束时间
    /// </summary>
    public DateTime ConflictEndTime { get; set; }

    /// <summary>
    /// 冲突类型
    /// </summary>
    public string ConflictType { get; set; } = string.Empty;
}

/// <summary>
/// 排期方案推荐请求 DTO
/// </summary>
public class SuggestScheduleDto
{
    /// <summary>
    /// 场馆ID
    /// </summary>
    [Required]
    public int VenueId { get; set; }

    /// <summary>
    /// 活动ID
    /// </summary>
    [Required]
    public int EventId { get; set; }

    /// <summary>
    /// 期望开始日期范围（开始）
    /// </summary>
    [Required]
    public DateTime PreferredDateFrom { get; set; }

    /// <summary>
    /// 期望开始日期范围（结束）
    /// </summary>
    [Required]
    public DateTime PreferredDateTo { get; set; }

    /// <summary>
    /// 活动持续时长（小时）
    /// </summary>
    [Required]
    [Range(1, 72)]
    public int DurationHours { get; set; }

    /// <summary>
    /// 期望的资源类型列表
    /// </summary>
    public List<string> PreferredResourceTypes { get; set; } = new List<string>();

    /// <summary>
    /// 优先级
    /// </summary>
    public int Priority { get; set; } = 0;
}

/// <summary>
/// 排期方案推荐结果 DTO
/// </summary>
public class ScheduleSuggestionDto
{
    /// <summary>
    /// 方案ID
    /// </summary>
    public string SuggestionId { get; set; } = Guid.NewGuid().ToString();

    /// <summary>
    /// 推荐分数（0-100）
    /// </summary>
    public int Score { get; set; }

    /// <summary>
    /// 开始时间
    /// </summary>
    public DateTime StartTime { get; set; }

    /// <summary>
    /// 结束时间
    /// </summary>
    public DateTime EndTime { get; set; }

    /// <summary>
    /// 资源分配列表
    /// </summary>
    public List<ResourceAllocationDto> ResourceAllocations { get; set; } = new List<ResourceAllocationDto>();

    /// <summary>
    /// 推荐理由
    /// </summary>
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// 资源分配 DTO
/// </summary>
public class ResourceAllocationDto
{
    /// <summary>
    /// 资源ID
    /// </summary>
    public int ResourceId { get; set; }

    /// <summary>
    /// 资源名称
    /// </summary>
    public string ResourceName { get; set; } = string.Empty;

    /// <summary>
    /// 资源类型
    /// </summary>
    public string ResourceType { get; set; } = string.Empty;
}

/// <summary>
/// 锁定档期请求 DTO
/// </summary>
public class LockScheduleDto
{
    /// <summary>
    /// 活动ID
    /// </summary>
    [Required]
    public int EventId { get; set; }

    /// <summary>
    /// 场馆ID
    /// </summary>
    [Required]
    public int VenueId { get; set; }

    /// <summary>
    /// 资源ID
    /// </summary>
    [Required]
    public int ResourceId { get; set; }

    /// <summary>
    /// 开始时间
    /// </summary>
    [Required]
    public DateTime StartTime { get; set; }

    /// <summary>
    /// 结束时间
    /// </summary>
    [Required]
    public DateTime EndTime { get; set; }
}

/// <summary>
/// 确认排期请求 DTO
/// </summary>
public class ConfirmScheduleDto
{
    /// <summary>
    /// 活动ID
    /// </summary>
    [Required]
    public int EventId { get; set; }

    /// <summary>
    /// 排期时段ID列表
    /// </summary>
    [Required]
    public List<int> ScheduleSlotIds { get; set; } = new List<int>();
}

/// <summary>
/// 日历视图数据 DTO
/// </summary>
public class CalendarViewDto
{
    /// <summary>
    /// 开始日期
    /// </summary>
    public DateTime StartDate { get; set; }

    /// <summary>
    /// 结束日期
    /// </summary>
    public DateTime EndDate { get; set; }

    /// <summary>
    /// 日历事件列表
    /// </summary>
    public List<CalendarEventDto> Events { get; set; } = new List<CalendarEventDto>();

    /// <summary>
    /// 场馆资源占用概览
    /// </summary>
    public List<VenueResourceOverviewDto> VenueOverviews { get; set; } = new List<VenueResourceOverviewDto>();
}

/// <summary>
/// 日历事件 DTO
/// </summary>
public class CalendarEventDto
{
    /// <summary>
    /// 事件ID
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// 事件标题
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 开始时间
    /// </summary>
    public DateTime Start { get; set; }

    /// <summary>
    /// 结束时间
    /// </summary>
    public DateTime End { get; set; }

    /// <summary>
    /// 场馆ID
    /// </summary>
    public int VenueId { get; set; }

    /// <summary>
    /// 资源ID
    /// </summary>
    public int ResourceId { get; set; }

    /// <summary>
    /// 事件状态
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 背景颜色
    /// </summary>
    public string BackgroundColor { get; set; } = string.Empty;

    /// <summary>
    /// 边框颜色
    /// </summary>
    public string BorderColor { get; set; } = string.Empty;

    /// <summary>
    /// 是否全天事件
    /// </summary>
    public bool AllDay { get; set; }
}

/// <summary>
/// 场馆资源占用概览 DTO
/// </summary>
public class VenueResourceOverviewDto
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
    /// 资源总数
    /// </summary>
    public int TotalResources { get; set; }

    /// <summary>
    /// 已占用资源数
    /// </summary>
    public int OccupiedResources { get; set; }

    /// <summary>
    /// 可用资源数
    /// </summary>
    public int AvailableResources { get; set; }

    /// <summary>
    /// 占用率（百分比）
    /// </summary>
    public double OccupancyRate { get; set; }
}

/// <summary>
/// 排期查询参数 DTO
/// </summary>
public class ScheduleQueryDto
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
    /// 状态
    /// </summary>
    public string? Status { get; set; }
}
