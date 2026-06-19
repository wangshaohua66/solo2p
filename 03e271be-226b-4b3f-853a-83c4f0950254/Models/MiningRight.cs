using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiningGovApi.Models;

public class MiningRight
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string LicenseNo { get; set; } = string.Empty;

    [Required]
    public int MineId { get; set; }

    [ForeignKey(nameof(MineId))]
    public Mine? Mine { get; set; }

    [Required]
    public MineType MineType { get; set; }

    [MaxLength(500)]
    public string? MiningArea { get; set; }

    public DateTime ValidFrom { get; set; }

    public DateTime ValidTo { get; set; }

    [MaxLength(200)]
    public string? Holder { get; set; }

    public MiningRightStatus Status { get; set; } = MiningRightStatus.Draft;

    public MiningRightChangeType ChangeType { get; set; }

    [MaxLength(2000)]
    public string? Remark { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ApprovedAt { get; set; }

    public int? CurrentApprovalLevel { get; set; }

    public List<MiningRightApproval> Approvals { get; set; } = [];
    public List<FeeRecord> FeeRecords { get; set; } = [];
    public List<TradeOrder> TradeOrders { get; set; } = [];
}

public class MiningRightApproval
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MiningRightId { get; set; }

    [ForeignKey(nameof(MiningRightId))]
    public MiningRight? MiningRight { get; set; }

    public int ApprovalLevel { get; set; }

    public int? ApproverId { get; set; }

    [ForeignKey(nameof(ApproverId))]
    public User? Approver { get; set; }

    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

    [MaxLength(2000)]
    public string? Opinion { get; set; }

    public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ProcessedAt { get; set; }
}
