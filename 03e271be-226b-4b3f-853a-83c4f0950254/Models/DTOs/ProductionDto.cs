using System.ComponentModel.DataAnnotations;

namespace MiningGovApi.Models.DTOs;

public class ProductionReportCreateDto
{
    [Required]
    public int MineId { get; set; }

    [Required]
    public int Year { get; set; }

    [Required]
    public int Month { get; set; }

    [Required]
    [Range(0, double.MaxValue)]
    public decimal Output { get; set; }

    [Required]
    [Range(0, double.MaxValue)]
    public decimal Sales { get; set; }

    [Required]
    [Range(0, 100)]
    public decimal Grade { get; set; }

    public string? Remark { get; set; }
}

public class ProductionReportBatchCreateDto
{
    public List<ProductionReportCreateDto> Reports { get; set; } = [];
}

public class ProductionReportVerifyDto
{
    [Required]
    public int ReportId { get; set; }

    [Required]
    public bool Verified { get; set; }

    public string VerificationNote { get; set; } = string.Empty;
}

public class ProductionReportQueryDto : PagedQuery
{
    public int? MineId { get; set; }
    public int? Year { get; set; }
    public int? Month { get; set; }
    public bool? IsAbnormal { get; set; }
    public bool? Verified { get; set; }
}

public class ProductionReportDto
{
    public int Id { get; set; }
    public int MineId { get; set; }
    public string MineName { get; set; } = string.Empty;
    public int ReporterId { get; set; }
    public string ReporterName { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal Output { get; set; }
    public decimal Sales { get; set; }
    public decimal Grade { get; set; }
    public string? Remark { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsAbnormal { get; set; }
    public string? AbnormalReason { get; set; }
    public bool? Verified { get; set; }
    public int? VerifierId { get; set; }
    public string? VerifierName { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? VerificationNote { get; set; }
}
