using System.ComponentModel.DataAnnotations;

namespace SpecialEquipmentInspection.Models;

public class InspectionItem
{
    public int Id { get; set; }

    public int InspectionId { get; set; }

    [Required]
    [StringLength(32)]
    public string ItemCode { get; set; } = string.Empty;

    [Required]
    [StringLength(128)]
    public string ItemName { get; set; } = string.Empty;

    [StringLength(256)]
    public string Standard { get; set; } = string.Empty;

    public InspectionResult Result { get; set; }

    public string Data { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public Inspection? Inspection { get; set; }
}
