using System.ComponentModel.DataAnnotations;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Dtos;

public class CreateDeviceDto
{
    [Required(ErrorMessage = "设备编码不能为空")]
    [StringLength(32)]
    public string DeviceCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "设备名称不能为空")]
    [StringLength(128)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 6, ErrorMessage = "设备类型无效")]
    public DeviceType Type { get; set; }

    [StringLength(128)]
    public string Manufacturer { get; set; } = string.Empty;

    [StringLength(64)]
    public string Model { get; set; } = string.Empty;

    public DateTime ManufacturingDate { get; set; }

    [Required(ErrorMessage = "使用单位编码不能为空")]
    [StringLength(32)]
    public string UseUnitCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "使用单位名称不能为空")]
    [StringLength(128)]
    public string UseUnitName { get; set; } = string.Empty;

    [StringLength(32)]
    public string UseUnitContact { get; set; } = string.Empty;

    [StringLength(20)]
    public string UseUnitPhone { get; set; } = string.Empty;

    [Required(ErrorMessage = "区域不能为空")]
    [StringLength(32)]
    public string Region { get; set; } = string.Empty;

    public string TechnicalParameters { get; set; } = string.Empty;

    [Required(ErrorMessage = "下次检验日期不能为空")]
    public DateTime NextInspectionDate { get; set; }

    public DeviceStatus Status { get; set; } = DeviceStatus.Normal;
}

public class UpdateDeviceDto : CreateDeviceDto { }

public class DeviceStatusChangeDto
{
    [Range(1, 5, ErrorMessage = "设备状态无效")]
    public DeviceStatus Status { get; set; }
}

public class BatchImportDeviceDto
{
    [Required]
    public List<CreateDeviceDto> Devices { get; set; } = new();
}
