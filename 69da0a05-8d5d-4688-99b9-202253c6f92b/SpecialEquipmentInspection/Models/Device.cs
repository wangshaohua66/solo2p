using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class Device
{
    public int Id { get; set; }

    [Required]
    [StringLength(32)]
    public string DeviceCode { get; set; } = string.Empty;

    [Required]
    [StringLength(128)]
    public string Name { get; set; } = string.Empty;

    public DeviceType Type { get; set; }

    [StringLength(128)]
    public string Manufacturer { get; set; } = string.Empty;

    [StringLength(64)]
    public string Model { get; set; } = string.Empty;

    public DateTime ManufacturingDate { get; set; }

    [Required]
    [StringLength(32)]
    public string UseUnitCode { get; set; } = string.Empty;

    [Required]
    [StringLength(128)]
    public string UseUnitName { get; set; } = string.Empty;

    [StringLength(32)]
    public string UseUnitContact { get; set; } = string.Empty;

    [StringLength(20)]
    public string UseUnitPhone { get; set; } = string.Empty;

    [Required]
    [StringLength(32)]
    public string Region { get; set; } = string.Empty;

    public string TechnicalParameters { get; set; } = string.Empty;

    public DateTime? LastInspectionDate { get; set; }

    public DateTime NextInspectionDate { get; set; }

    public DeviceStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<Inspection> Inspections { get; set; } = new();
}
