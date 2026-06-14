using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.DTOs;

public class AuditLogDto
{
    public string Id { get; set; } = string.Empty;
    public string TraceId { get; set; } = string.Empty;
    public AuditActionType ActionType { get; set; }
    public string ActionTypeText { get; set; } = string.Empty;
    public string ActionName { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? OperatorId { get; set; }
    public string? OperatorName { get; set; }
    public UserRole? OperatorRole { get; set; }
    public string? IpAddress { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public bool Status { get; set; }
    public string? ErrorMessage { get; set; }
    public long DurationMs { get; set; }
    public DateTime Timestamp { get; set; }
}

public class AuditLogQueryRequest : CursorPagedQuery
{
    public AuditActionType? ActionType { get; set; }
    public string? Module { get; set; }
    public string? OperatorId { get; set; }
    public string? OperatorName { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public bool? Status { get; set; }
}
