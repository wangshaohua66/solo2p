using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiningGovApi.Models;

public class TradeOrder
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MiningRightId { get; set; }

    [ForeignKey(nameof(MiningRightId))]
    public MiningRight? MiningRight { get; set; }

    [Required]
    [MaxLength(200)]
    public string Transferor { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Transferee { get; set; }

    public decimal AskingPrice { get; set; }

    public decimal? BidPrice { get; set; }

    public decimal? AppraisalPrice { get; set; }

    public TradeStatus Status { get; set; } = TradeStatus.Listed;

    public DateTime ListedAt { get; set; } = DateTime.UtcNow;

    public DateTime? BidDeadline { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public int? ReviewerId { get; set; }

    [ForeignKey(nameof(ReviewerId))]
    public User? Reviewer { get; set; }

    [MaxLength(2000)]
    public string? ReviewOpinion { get; set; }

    public bool NeedsRecheck { get; set; }

    public int? RecheckerId { get; set; }

    [ForeignKey(nameof(RecheckerId))]
    public User? Rechecker { get; set; }

    public DateTime? RecheckedAt { get; set; }

    [MaxLength(2000)]
    public string? RecheckOpinion { get; set; }

    public DateTime? CompletedAt { get; set; }
}
