using System.ComponentModel.DataAnnotations;

namespace VenueManagementSystem.DTOs.Emergency;

/// <summary>
/// 触发应急预案请求 DTO
/// </summary>
public class TriggerEmergencyDto
{
    /// <summary>
    /// 预案ID
    /// </summary>
    [Required]
    public int PlanId { get; set; }

    /// <summary>
    /// 场馆ID
    /// </summary>
    [Required]
    public int VenueId { get; set; }

    /// <summary>
    /// 触发原因
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// 紧急程度：Low/Medium/High/Critical
    /// </summary>
    [Required]
    [RegularExpression("^(Low|Medium|High|Critical)$", ErrorMessage = "紧急程度只能是 Low、Medium、High 或 Critical")]
    public string Severity { get; set; } = "Medium";

    /// <summary>
    /// 触发人
    /// </summary>
    [MaxLength(100)]
    public string TriggeredBy { get; set; } = string.Empty;

    /// <summary>
    /// 详细信息（JSON格式）
    /// </summary>
    public string? DetailsJson { get; set; }
}

/// <summary>
/// 完成处置步骤请求 DTO
/// </summary>
public class CompleteStepDto
{
    /// <summary>
    /// 处置结果
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string Result { get; set; } = string.Empty;

    /// <summary>
    /// 处置备注
    /// </summary>
    [MaxLength(1000)]
    public string? Remark { get; set; }

    /// <summary>
    /// 完成人
    /// </summary>
    [MaxLength(100)]
    public string CompletedBy { get; set; } = string.Empty;

    /// <summary>
    /// 是否需要后续处理
    /// </summary>
    public bool NeedFollowUp { get; set; }
}

/// <summary>
/// 解除应急状态请求 DTO
/// </summary>
public class ResolveEmergencyDto
{
    /// <summary>
    /// 处置结果总结
    /// </summary>
    [Required]
    [MaxLength(1000)]
    public string Summary { get; set; } = string.Empty;

    /// <summary>
    /// 经验教训
    /// </summary>
    [MaxLength(2000)]
    public string? LessonsLearned { get; set; }

    /// <summary>
    /// 改进建议
    /// </summary>
    [MaxLength(2000)]
    public string? Improvements { get; set; }

    /// <summary>
    /// 解除人
    /// </summary>
    [MaxLength(100)]
    public string ResolvedBy { get; set; } = string.Empty;
}

/// <summary>
/// 应急预案 DTO
/// </summary>
public class EmergencyPlanDto
{
    /// <summary>
    /// 预案ID
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// 应急类型
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// 预案名称
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 预案描述
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// 处置步骤列表
    /// </summary>
    public List<EmergencyStepDto> Steps { get; set; } = new List<EmergencyStepDto>();

    /// <summary>
    /// 是否启用
    /// </summary>
    public bool IsEnabled { get; set; }
}

/// <summary>
/// 应急处置步骤 DTO
/// </summary>
public class EmergencyStepDto
{
    /// <summary>
    /// 步骤ID
    /// </summary>
    public int StepId { get; set; }

    /// <summary>
    /// 步骤序号
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// 步骤名称
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 步骤描述
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// 负责人角色
    /// </summary>
    public string ResponsibleRole { get; set; } = string.Empty;

    /// <summary>
    /// 预计时长（分钟）
    /// </summary>
    public int EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// 状态
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 完成时间
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// 处置结果
    /// </summary>
    public string? Result { get; set; }

    /// <summary>
    /// 是否可以操作
    /// </summary>
    public bool CanOperate { get; set; }
}

/// <summary>
/// 应急日志 DTO
/// </summary>
public class EmergencyLogDto
{
    /// <summary>
    /// 日志ID
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// 关联的预案ID
    /// </summary>
    public int PlanId { get; set; }

    /// <summary>
    /// 预案名称
    /// </summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>
    /// 所属场馆ID
    /// </summary>
    public int VenueId { get; set; }

    /// <summary>
    /// 场馆名称
    /// </summary>
    public string VenueName { get; set; } = string.Empty;

    /// <summary>
    /// 状态
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 紧急程度
    /// </summary>
    public string Severity { get; set; } = string.Empty;

    /// <summary>
    /// 触发原因
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// 触发时间
    /// </summary>
    public DateTime TriggeredAt { get; set; }

    /// <summary>
    /// 触发人
    /// </summary>
    public string TriggeredBy { get; set; } = string.Empty;

    /// <summary>
    /// 解决时间
    /// </summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>
    /// 解除人
    /// </summary>
    public string? ResolvedBy { get; set; }

    /// <summary>
    /// 处置步骤列表
    /// </summary>
    public List<EmergencyStepDto> Steps { get; set; } = new List<EmergencyStepDto>();

    /// <summary>
    /// 处置时长（分钟）
    /// </summary>
    public int? DurationMinutes { get; set; }
}

/// <summary>
/// 应急复盘报告 DTO
/// </summary>
public class EmergencyReportDto
{
    /// <summary>
    /// 报告ID
    /// </summary>
    public string ReportId { get; set; } = Guid.NewGuid().ToString();

    /// <summary>
    /// 应急日志ID
    /// </summary>
    public int LogId { get; set; }

    /// <summary>
    /// 预案名称
    /// </summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>
    /// 场馆名称
    /// </summary>
    public string VenueName { get; set; } = string.Empty;

    /// <summary>
    /// 触发原因
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// 紧急程度
    /// </summary>
    public string Severity { get; set; } = string.Empty;

    /// <summary>
    /// 触发时间
    /// </summary>
    public DateTime TriggeredAt { get; set; }

    /// <summary>
    /// 解除时间
    /// </summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>
    /// 总处置时长（分钟）
    /// </summary>
    public int TotalDurationMinutes { get; set; }

    /// <summary>
    /// 处置步骤执行情况
    /// </summary>
    public List<StepExecutionDto> StepExecutions { get; set; } = new List<StepExecutionDto>();

    /// <summary>
    /// 处置总结
    /// </summary>
    public string Summary { get; set; } = string.Empty;

    /// <summary>
    /// 经验教训
    /// </summary>
    public string LessonsLearned { get; set; } = string.Empty;

    /// <summary>
    /// 改进建议
    /// </summary>
    public string Improvements { get; set; } = string.Empty;

    /// <summary>
    /// 报告生成时间
    /// </summary>
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// 步骤执行情况 DTO
/// </summary>
public class StepExecutionDto
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
    /// 状态
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// 处置结果
    /// </summary>
    public string Result { get; set; } = string.Empty;

    /// <summary>
    /// 计划时长（分钟）
    /// </summary>
    public int PlannedDurationMinutes { get; set; }

    /// <summary>
    /// 实际时长（分钟）
    /// </summary>
    public int? ActualDurationMinutes { get; set; }

    /// <summary>
    /// 完成人
    /// </summary>
    public string? CompletedBy { get; set; }
}

/// <summary>
/// 应急记录查询参数 DTO
/// </summary>
public class EmergencyLogQueryDto : Common.PaginationQuery
{
    /// <summary>
    /// 场馆ID
    /// </summary>
    public int? VenueId { get; set; }

    /// <summary>
    /// 预案ID
    /// </summary>
    public int? PlanId { get; set; }

    /// <summary>
    /// 状态
    /// </summary>
    public string? Status { get; set; }

    /// <summary>
    /// 紧急程度
    /// </summary>
    public string? Severity { get; set; }

    /// <summary>
    /// 开始日期
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// 结束日期
    /// </summary>
    public DateTime? EndDate { get; set; }
}
