using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class InspectionPlan
{
    public int Id { get; set; }

    [Required]
    [StringLength(32)]
    public string PlanCode { get; set; } = string.Empty;

    [Required]
    public int Year { get; set; }

    [StringLength(32)]
    public string Region { get; set; } = string.Empty;

    public DeviceType? DeviceType { get; set; }

    public int? InspectorId { get; set; }

    [StringLength(32)]
    public string InspectorName { get; set; } = string.Empty;

    public int DeviceCount { get; set; }

    public PlanStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<Inspection> Inspections { get; set; } = new();
}
