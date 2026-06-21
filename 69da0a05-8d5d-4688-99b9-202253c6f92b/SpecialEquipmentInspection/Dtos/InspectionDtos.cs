using System.ComponentModel.DataAnnotations;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Dtos;

public class CreatePlanDto
{
    [Range(2000, 2100)]
    public int Year { get; set; }

    [StringLength(32)]
    public string Region { get; set; } = string.Empty;

    public DeviceType? DeviceType { get; set; }

    public int? InspectorId { get; set; }

    public List<int> DeviceIds { get; set; } = new();
}

public class CreateInspectionDto
{
    public int? PlanId { get; set; }

    [Required(ErrorMessage = "设备ID不能为空")]
    public int DeviceId { get; set; }

    [Required(ErrorMessage = "检验员ID不能为空")]
    public int InspectorId { get; set; }

    [Required(ErrorMessage = "计划检验日期不能为空")]
    public DateTime ScheduledDate { get; set; }
}

public class InspectionItemDto
{
    [Required]
    [StringLength(32)]
    public string ItemCode { get; set; } = string.Empty;

    [Required]
    [StringLength(128)]
    public string ItemName { get; set; } = string.Empty;

    [StringLength(256)]
    public string Standard { get; set; } = string.Empty;

    [Range(1, 4)]
    public InspectionResult Result { get; set; } = InspectionResult.Pass;

    public string Data { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class SubmitInspectionDto
{
    [Required(ErrorMessage = "检验结果不能为空")]
    [Range(1, 4, ErrorMessage = "检验结果无效")]
    public InspectionResult Result { get; set; }

    public string Conclusion { get; set; } = string.Empty;

    public DateTime? NextInspectionDate { get; set; }

    public List<string> Photos { get; set; } = new();

    public string Findings { get; set; } = string.Empty;

    public List<InspectionItemDto> Items { get; set; } = new();
}

public class RectificationCreateDto
{
    [Required]
    public int InspectionItemId { get; set; }

    [Required]
    public string Description { get; set; } = string.Empty;

    public int RectificationDays { get; set; } = 15;
}

public class RectificationFeedbackDto
{
    [Required(ErrorMessage = "整改结果不能为空")]
    public string RectificationResult { get; set; } = string.Empty;

    public DateTime? CompleteDate { get; set; }
}

public class ReinspectionDto
{
    [Range(1, 4)]
    public InspectionResult ItemResult { get; set; } = InspectionResult.Pass;

    public string Data { get; set; } = string.Empty;
}
