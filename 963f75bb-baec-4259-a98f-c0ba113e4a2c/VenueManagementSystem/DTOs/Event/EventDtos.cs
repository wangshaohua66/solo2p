using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.DTOs.Event;

/// <summary>
/// 创建赛事申报请求 DTO
/// </summary>
public class CreateEventDto
{
    /// <summary>
    /// 所属场馆ID
    /// </summary>
    [Required]
    public int VenueId { get; set; }

    /// <summary>
    /// 活动名称
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 活动类型
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// 活动描述
    /// </summary>
    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// 活动开始日期
    /// </summary>
    [Required]
    public DateTime StartDate { get; set; }

    /// <summary>
    /// 活动结束日期
    /// </summary>
    [Required]
    public DateTime EndDate { get; set; }

    /// <summary>
    /// 预期收入
    /// </summary>
    public decimal ExpectedRevenue { get; set; }
}

/// <summary>
/// 更新赛事信息请求 DTO
/// </summary>
public class UpdateEventDto
{
    /// <summary>
    /// 活动名称
    /// </summary>
    [MaxLength(200)]
    public string? Name { get; set; }

    /// <summary>
    /// 活动类型
    /// </summary>
    [MaxLength(50)]
    public string? Type { get; set; }

    /// <summary>
    /// 活动描述
    /// </summary>
    [MaxLength(1000)]
    public string? Description { get; set; }

    /// <summary>
    /// 活动开始日期
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// 活动结束日期
    /// </summary>
    public DateTime? EndDate { get; set; }

    /// <summary>
    /// 预期收入
    /// </summary>
    public decimal? ExpectedRevenue { get; set; }

    /// <summary>
    /// 活动状态
    /// </summary>
    [MaxLength(50)]
    public string? Status { get; set; }
}

/// <summary>
/// 赛事查询参数 DTO
/// </summary>
public class EventQueryDto : Common.PaginationQuery
{
    /// <summary>
    /// 状态筛选
    /// </summary>
    public string? Status { get; set; }

    /// <summary>
    /// 类型筛选
    /// </summary>
    public string? Type { get; set; }

    /// <summary>
    /// 场馆ID筛选
    /// </summary>
    public int? VenueId { get; set; }

    /// <summary>
    /// 开始日期范围
    /// </summary>
    public DateTime? StartDateFrom { get; set; }

    /// <summary>
    /// 结束日期范围
    /// </summary>
    public DateTime? EndDateTo { get; set; }

    /// <summary>
    /// 创建人
    /// </summary>
    public string? CreatedBy { get; set; }
}

/// <summary>
/// 审批请求 DTO
/// </summary>
public class ApprovalRequestDto
{
    /// <summary>
    /// 审批意见
    /// </summary>
    [MaxLength(500)]
    public string Comments { get; set; } = string.Empty;
}

/// <summary>
/// 审批流程 DTO
/// </summary>
public class ApprovalFlowDto
{
    /// <summary>
    /// 步骤ID
    /// </summary>
    public int StepId { get; set; }

    /// <summary>
    /// 步骤名称
    /// </summary>
    public string StepName { get; set; } = string.Empty;

    /// <summary>
    /// 分配给
    /// </summary>
    public string AssignedTo { get; set; } = string.Empty;

    /// <summary>
    /// 审批状态
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 审批意见
    /// </summary>
    public string Comments { get; set; } = string.Empty;

    /// <summary>
    /// 截止日期
    /// </summary>
    public DateTime DueDate { get; set; }

    /// <summary>
    /// 完成时间
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// 是否可以操作
    /// </summary>
    public bool CanOperate { get; set; }
}
