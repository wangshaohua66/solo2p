using System.ComponentModel.DataAnnotations;

namespace MiningGovApi.Models.DTOs;

public class MiningRightCreateDto
{
    [Required]
    public int MineId { get; set; }

    [Required]
    public MineType MineType { get; set; }

    [Required]
    public MiningRightChangeType ChangeType { get; set; }

    public string? MiningArea { get; set; }

    [Required]
    public DateTime ValidFrom { get; set; }

    [Required]
    public DateTime ValidTo { get; set; }

    public string? Holder { get; set; }

    public string? Remark { get; set; }
}

public class MiningRightUpdateDto
{
    public MineType? MineType { get; set; }
    public string? MiningArea { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }
    public string? Holder { get; set; }
    public string? Remark { get; set; }
}

public class MiningRightApprovalDto
{
    [Required]
    public int MiningRightId { get; set; }

    [Required]
    public ApprovalStatus Status { get; set; }

    [Required]
    public string Opinion { get; set; } = string.Empty;
}

public class MiningRightQueryDto : PagedQuery
{
    public int? MineId { get; set; }
    public MiningRightStatus? Status { get; set; }
    public MineType? MineType { get; set; }
    public MiningRightChangeType? ChangeType { get; set; }
    public string? LicenseNo { get; set; }
}

public class MiningRightDto
{
    public int Id { get; set; }
    public string LicenseNo { get; set; } = string.Empty;
    public int MineId { get; set; }
    public string MineName { get; set; } = string.Empty;
    public MineType MineType { get; set; }
    public string? MiningArea { get; set; }
    public DateTime ValidFrom { get; set; }
    public DateTime ValidTo { get; set; }
    public string? Holder { get; set; }
    public MiningRightStatus Status { get; set; }
    public MiningRightChangeType ChangeType { get; set; }
    public string? Remark { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public int? CurrentApprovalLevel { get; set; }
    public List<MiningRightApprovalDtoItem> Approvals { get; set; } = [];
}

public class MiningRightApprovalDtoItem
{
    public int Id { get; set; }
    public int ApprovalLevel { get; set; }
    public int? ApproverId { get; set; }
    public string? ApproverName { get; set; }
    public ApprovalStatus Status { get; set; }
    public string? Opinion { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
