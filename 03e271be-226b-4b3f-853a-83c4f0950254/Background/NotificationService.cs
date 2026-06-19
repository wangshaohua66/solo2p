namespace MiningGovApi.Background;

public interface INotificationService
{
    Task SendApprovalReminderAsync(int miningRightId, int currentLevel, int delayHours, CancellationToken ct = default);
    Task SendAlertEscalationAsync(int alertId, int originalInspectorId, int escalatedToId, CancellationToken ct = default);
    Task SendFeeReminderAsync(int feeRecordId, int daysOverdue, decimal overdueAmount, CancellationToken ct = default);
    Task<(List<NotificationRecord> Items, int TotalCount)> GetNotificationsAsync(int? userId = null, int pageIndex = 1, int pageSize = 20);
    Task MarkAsReadAsync(int notificationId, int userId);
}

public class NotificationRecord
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? RelatedId { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
}

public class NotificationService : INotificationService
{
    private static readonly List<NotificationRecord> _records = [];
    private static int _nextId = 1;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(ILogger<NotificationService> logger)
    {
        _logger = logger;
    }

    public Task SendApprovalReminderAsync(int miningRightId, int currentLevel, int delayHours, CancellationToken ct = default)
    {
        var notification = new NotificationRecord
        {
            Id = Interlocked.Increment(ref _nextId),
            UserId = null,
            Type = "ApprovalReminder",
            Title = $"矿权审批超时提醒 - 第{currentLevel}级",
            Content = $"采矿权ID {miningRightId} 的审批已超过{delayHours}小时未处理，已自动流转至下一级审批节点",
            RelatedId = miningRightId.ToString(),
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };
        lock (_records) { _records.Insert(0, notification); }

        _logger.LogInformation("[审批提醒] MiningRight={MiningRightId} Level={Level} DelayHours={DelayHours}",
            miningRightId, currentLevel, delayHours);

        return Task.CompletedTask;
    }

    public Task SendAlertEscalationAsync(int alertId, int originalInspectorId, int escalatedToId, CancellationToken ct = default)
    {
        var notification = new NotificationRecord
        {
            Id = Interlocked.Increment(ref _nextId),
            UserId = escalatedToId,
            Type = "AlertEscalation",
            Title = $"安全预警升级通知 - 预警ID {alertId}",
            Content = $"安全预警ID {alertId} 已超过4小时未处置，现升级至您处处理，请尽快响应处置",
            RelatedId = alertId.ToString(),
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };
        lock (_records) { _records.Insert(0, notification); }

        _logger.LogInformation("[预警升级] Alert={AlertId} FromInspector={FromInspector} ToSupervisor={ToSupervisor}",
            alertId, originalInspectorId, escalatedToId);

        return Task.CompletedTask;
    }

    public Task SendFeeReminderAsync(int feeRecordId, int daysOverdue, decimal overdueAmount, CancellationToken ct = default)
    {
        var notification = new NotificationRecord
        {
            Id = Interlocked.Increment(ref _nextId),
            UserId = null,
            Type = "FeeReminder",
            Title = $"费款逾期催缴通知 - 已逾期{daysOverdue}天",
            Content = $"费款记录ID {feeRecordId} 已逾期{daysOverdue}天，逾期金额{overdueAmount:C}，按日千分之一计收滞纳金。请尽快缴纳",
            RelatedId = feeRecordId.ToString(),
            CreatedAt = DateTime.UtcNow,
            IsRead = false
        };
        lock (_records) { _records.Insert(0, notification); }

        _logger.LogInformation("[催缴通知] FeeRecord={FeeRecordId} DaysOverdue={DaysOverdue} Amount={Amount:C}",
            feeRecordId, daysOverdue, overdueAmount);

        return Task.CompletedTask;
    }

    public Task<(List<NotificationRecord> Items, int TotalCount)> GetNotificationsAsync(int? userId = null, int pageIndex = 1, int pageSize = 20)
    {
        IEnumerable<NotificationRecord> query = _records;
        if (userId.HasValue)
        {
            query = query.Where(n => !n.UserId.HasValue || n.UserId.Value == userId.Value);
        }
        var totalCount = query.Count();
        var list = query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToList();
        return Task.FromResult((list, totalCount));
    }

    public Task MarkAsReadAsync(int notificationId, int userId)
    {
        var record = _records.FirstOrDefault(n => n.Id == notificationId
            && (!n.UserId.HasValue || n.UserId.Value == userId));
        if (record != null)
        {
            record.IsRead = true;
        }
        return Task.CompletedTask;
    }
}
