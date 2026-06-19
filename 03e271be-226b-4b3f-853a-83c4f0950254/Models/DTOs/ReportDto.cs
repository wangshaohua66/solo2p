namespace MiningGovApi.Models.DTOs;

public class ReportQueryDto
{
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? MineId { get; set; }
    public MineType? MineType { get; set; }
    public string? Area { get; set; }
}

public class ProductionTrendDto
{
    public string Period { get; set; } = string.Empty;
    public int MineId { get; set; }
    public string MineName { get; set; } = string.Empty;
    public MineType MineType { get; set; }
    public decimal Output { get; set; }
    public decimal Sales { get; set; }
    public decimal Grade { get; set; }
}

public class FeeCollectionDto
{
    public string Period { get; set; } = string.Empty;
    public decimal TotalBilled { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalOverdue { get; set; }
    public decimal CollectionRate => TotalBilled > 0 ? TotalPaid / TotalBilled * 100 : 0;
}

public class SafetyDisposalDto
{
    public int MineId { get; set; }
    public string MineName { get; set; } = string.Empty;
    public int TotalAlerts { get; set; }
    public int ClosedAlerts { get; set; }
    public int PendingAlerts { get; set; }
    public int EscalatedAlerts { get; set; }
    public double AvgResponseHours { get; set; }
    public double AvgCloseHours { get; set; }
}

public class MiningRightExpiryDto
{
    public int Id { get; set; }
    public string LicenseNo { get; set; } = string.Empty;
    public int MineId { get; set; }
    public string MineName { get; set; } = string.Empty;
    public string? Holder { get; set; }
    public DateTime ValidTo { get; set; }
    public int DaysToExpiry { get; set; }
}

public class MineStatDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public MineType MineType { get; set; }
    public int TotalProductionReports { get; set; }
    public int AbnormalReports { get; set; }
    public int TotalAlerts { get; set; }
    public int OpenAlerts { get; set; }
    public decimal TotalFeesBilled { get; set; }
    public decimal TotalFeesPaid { get; set; }
}
