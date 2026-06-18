namespace WaterManagement.API.DTOs;

using WaterManagement.API.Models;

public class DispatchOrderCreateDto
{
    public string GateId { get; set; } = string.Empty;
    public string? ReservoirId { get; set; }
    public double TargetOpening { get; set; }
    public string ReceiverId { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? Instructions { get; set; }
    public string Priority { get; set; } = "normal";
    public int ConfirmDeadlineMinutes { get; set; } = 30;
    public string? SenderName { get; set; }
}

public class DispatchOrderUpdateDto
{
    public double? TargetOpening { get; set; }
    public string? Instructions { get; set; }
    public string? Priority { get; set; }
}

public class DispatchOrderConfirmDto
{
    public double ActualOpening { get; set; }
    public string? Remark { get; set; }
    public string? OperatorName { get; set; }
}

public class DispatchOrderCloseDto
{
    public string? Remark { get; set; }
    public string? OperatorName { get; set; }
}

public class DispatchOrderDto
{
    public string Id { get; set; } = string.Empty;
    public string OrderCode { get; set; } = string.Empty;
    public string GateId { get; set; } = string.Empty;
    public string GateName { get; set; } = string.Empty;
    public string ReservoirId { get; set; } = string.Empty;
    public string ReservoirName { get; set; } = string.Empty;
    public double TargetOpening { get; set; }
    public double? ActualOpening { get; set; }
    public DispatchStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string Priority { get; set; } = "normal";
    public string? Reason { get; set; }
    public string? Instructions { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string ReceiverId { get; set; } = string.Empty;
    public string ReceiverName { get; set; } = string.Empty;
    public DateTime ConfirmDeadline { get; set; }
    public DateTime? SendTime { get; set; }
    public DateTime? DeliverTime { get; set; }
    public DateTime? ConfirmTime { get; set; }
    public DateTime? CloseTime { get; set; }
    public DateTime CreatedAt { get; set; }
    public int RemainingSeconds { get; set; }
}

public class DispatchTraceDto
{
    public DateTime Timestamp { get; set; }
    public DispatchStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? OperatorName { get; set; }
    public string? Remark { get; set; }
}

public class DispatchStatsDto
{
    public int TotalOrders { get; set; }
    public int PendingOrders { get; set; }
    public int ConfirmedOrders { get; set; }
    public int OverdueOrders { get; set; }
    public int ClosedOrders { get; set; }
    public double ConfirmRate { get; set; }
    public double AvgConfirmMinutes { get; set; }
    public List<DispatchGateStat> ByGate { get; set; } = new();
}

public class DispatchGateStat
{
    public string Gate { get; set; } = string.Empty;
    public int Count { get; set; }
    public int Confirmed { get; set; }
}

public class DispatchOrderQueryParams : PagedQueryParams
{
    public string? Status { get; set; }
    public string? GateId { get; set; }
    public string? ReservoirId { get; set; }
    public string? ReceiverId { get; set; }
    public DateTime? FromTime { get; set; }
    public DateTime? ToTime { get; set; }
}
