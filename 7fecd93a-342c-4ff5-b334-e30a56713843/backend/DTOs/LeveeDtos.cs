using System.ComponentModel.DataAnnotations;
using WaterManagement.API.Models;

namespace WaterManagement.API.DTOs;

public class LeveeDto
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string RiverName { get; set; } = string.Empty;
    public string StartPoint { get; set; } = string.Empty;
    public string EndPoint { get; set; } = string.Empty;
    public double LengthKm { get; set; }
    public string DesignLevel { get; set; } = string.Empty;
    public double DesignWaterLevel { get; set; }
    public double GuaranteeWaterLevel { get; set; }
    public double WarningWaterLevel { get; set; }
    public string Material { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ResponsibleUnit { get; set; } = string.Empty;
    public string ResponsiblePerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class LeveeCreateDto
{
    [Required(ErrorMessage = "堤防编号不能为空")]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "堤防名称不能为空")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "所属河流不能为空")]
    public string RiverName { get; set; } = string.Empty;

    [Required(ErrorMessage = "起点不能为空")]
    public string StartPoint { get; set; } = string.Empty;

    [Required(ErrorMessage = "终点不能为空")]
    public string EndPoint { get; set; } = string.Empty;

    [Required(ErrorMessage = "长度不能为空")]
    [Range(0.01, double.MaxValue, ErrorMessage = "长度必须大于0")]
    public double LengthKm { get; set; }

    [Required(ErrorMessage = "设计等级不能为空")]
    public string DesignLevel { get; set; } = string.Empty;

    [Required(ErrorMessage = "设计水位不能为空")]
    public double DesignWaterLevel { get; set; }

    [Required(ErrorMessage = "保证水位不能为空")]
    public double GuaranteeWaterLevel { get; set; }

    [Required(ErrorMessage = "警戒水位不能为空")]
    public double WarningWaterLevel { get; set; }

    [Required(ErrorMessage = "结构材料不能为空")]
    public string Material { get; set; } = string.Empty;

    [Required(ErrorMessage = "状态不能为空")]
    public string Status { get; set; } = string.Empty;

    [Required(ErrorMessage = "责任单位不能为空")]
    public string ResponsibleUnit { get; set; } = string.Empty;

    [Required(ErrorMessage = "责任人不能为空")]
    public string ResponsiblePerson { get; set; } = string.Empty;

    [Required(ErrorMessage = "联系电话不能为空")]
    public string ContactPhone { get; set; } = string.Empty;

    public string? Description { get; set; }
}

public class LeveeUpdateDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? RiverName { get; set; }
    public string? StartPoint { get; set; }
    public string? EndPoint { get; set; }
    public double? LengthKm { get; set; }
    public string? DesignLevel { get; set; }
    public double? DesignWaterLevel { get; set; }
    public double? GuaranteeWaterLevel { get; set; }
    public double? WarningWaterLevel { get; set; }
    public string? Material { get; set; }
    public string? Status { get; set; }
    public string? ResponsibleUnit { get; set; }
    public string? ResponsiblePerson { get; set; }
    public string? ContactPhone { get; set; }
    public string? Description { get; set; }
}
