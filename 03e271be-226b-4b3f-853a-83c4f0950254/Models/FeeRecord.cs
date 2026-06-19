using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiningGovApi.Models;

public class FeeRecord
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MiningRightId { get; set; }

    [ForeignKey(nameof(MiningRightId))]
    public MiningRight? MiningRight { get; set; }

    public int Year { get; set; }

    public int Quarter { get; set; }

    public decimal UsageFee { get; set; }

    public decimal CompensationFee { get; set; }

    public decimal TotalAmount => UsageFee + CompensationFee;

    public decimal LateFee { get; set; }

    public decimal PaidAmount { get; set; }

    public FeeStatus Status { get; set; } = FeeStatus.Pending;

    public DateTime BilledAt { get; set; }

    public DateTime DueDate { get; set; }

    public DateTime? PaidAt { get; set; }

    public DateTime? RemindedAt { get; set; }

    [MaxLength(1000)]
    public string? Remark { get; set; }
}
