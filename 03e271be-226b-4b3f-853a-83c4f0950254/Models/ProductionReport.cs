using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiningGovApi.Models;

public class ProductionReport
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MineId { get; set; }

    [ForeignKey(nameof(MineId))]
    public Mine? Mine { get; set; }

    [Required]
    public int ReporterId { get; set; }

    [ForeignKey(nameof(ReporterId))]
    public User? Reporter { get; set; }

    [Required]
    public int Year { get; set; }

    [Required]
    public int Month { get; set; }

    public decimal Output { get; set; }

    public decimal Sales { get; set; }

    public decimal Grade { get; set; }

    [MaxLength(2000)]
    public string? Remark { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsAbnormal { get; set; }

    [MaxLength(500)]
    public string? AbnormalReason { get; set; }

    public bool? Verified { get; set; }

    public int? VerifierId { get; set; }

    [ForeignKey(nameof(VerifierId))]
    public User? Verifier { get; set; }

    public DateTime? VerifiedAt { get; set; }

    [MaxLength(2000)]
    public string? VerificationNote { get; set; }
}
