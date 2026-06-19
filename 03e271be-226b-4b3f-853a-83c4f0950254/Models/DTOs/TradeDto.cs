using System.ComponentModel.DataAnnotations;

namespace MiningGovApi.Models.DTOs;

public class TradeOrderCreateDto
{
    [Required]
    public int MiningRightId { get; set; }

    [Required]
    public string Transferor { get; set; } = string.Empty;

    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal AskingPrice { get; set; }

    public decimal? AppraisalPrice { get; set; }

    public DateTime? BidDeadline { get; set; }
}

public class TradeOrderBidDto
{
    [Required]
    public int TradeOrderId { get; set; }

    [Required]
    public string Transferee { get; set; } = string.Empty;

    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal BidPrice { get; set; }
}

public class TradeOrderReviewDto
{
    [Required]
    public int TradeOrderId { get; set; }

    [Required]
    public bool Approved { get; set; }

    [Required]
    public string ReviewOpinion { get; set; } = string.Empty;
}

public class TradeOrderRecheckDto
{
    [Required]
    public int TradeOrderId { get; set; }

    [Required]
    public bool Approved { get; set; }

    [Required]
    public string RecheckOpinion { get; set; } = string.Empty;
}

public class TradeOrderQueryDto : PagedQuery
{
    public int? MiningRightId { get; set; }
    public TradeStatus? Status { get; set; }
    public string? Transferor { get; set; }
    public string? Transferee { get; set; }
}

public class TradeOrderDto
{
    public int Id { get; set; }
    public int MiningRightId { get; set; }
    public string LicenseNo { get; set; } = string.Empty;
    public string Transferor { get; set; } = string.Empty;
    public string? Transferee { get; set; }
    public decimal AskingPrice { get; set; }
    public decimal? BidPrice { get; set; }
    public decimal? AppraisalPrice { get; set; }
    public TradeStatus Status { get; set; }
    public DateTime ListedAt { get; set; }
    public DateTime? BidDeadline { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewerId { get; set; }
    public string? ReviewerName { get; set; }
    public string? ReviewOpinion { get; set; }
    public bool NeedsRecheck { get; set; }
    public int? RecheckerId { get; set; }
    public string? RecheckerName { get; set; }
    public DateTime? RecheckedAt { get; set; }
    public string? RecheckOpinion { get; set; }
    public DateTime? CompletedAt { get; set; }
}
