using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class NotificationService : INotificationService
{
    private readonly INotificationRecordRepository _notificationRepository;
    private readonly IAlertRepository _alertRepository;
    private readonly INotificationPreferenceRepository _preferenceRepository;
    private readonly ICustomerRepository _customerRepository;

    public NotificationService(
        INotificationRecordRepository notificationRepository,
        IAlertRepository alertRepository,
        INotificationPreferenceRepository preferenceRepository,
        ICustomerRepository customerRepository)
    {
        _notificationRepository = notificationRepository;
        _alertRepository = alertRepository;
        _preferenceRepository = preferenceRepository;
        _customerRepository = customerRepository;
    }

    public async Task SendAlertNotificationAsync(Alert alert)
    {
        try
        {
            var preferences = await GetNotificationPreferences(alert.CustomerId, alert.Severity);

            foreach (var preference in preferences)
            {
                var record = new NotificationRecord
                {
                    AlertId = alert.Id,
                    CustomerId = alert.CustomerId,
                    Channel = preference.Channel,
                    Recipient = preference.Recipient ?? string.Empty,
                    Subject = GenerateSubject(alert),
                    Content = GenerateContent(alert),
                    IsSent = false,
                    RetryCount = 0,
                    EscalationLevel = preference.EscalationLevel
                };

                await _notificationRepository.AddAsync(record);

                try
                {
                    await SendNotificationAsync(preference.Channel, record.Recipient, record.Subject, record.Content);
                    record.IsSent = true;
                    record.SentAt = DateTime.UtcNow;
                    Log.Information("告警通知发送成功: 通道={Channel}, 接收人={Recipient}, 告警={AlertCode}",
                        preference.Channel, record.Recipient, alert.AlertCode);
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "告警通知发送失败: 通道={Channel}, 接收人={Recipient}, 告警={AlertCode}",
                        preference.Channel, record.Recipient, alert.AlertCode);
                    record.ErrorMessage = ex.Message;
                    record.RetryCount = 1;
                }

                _notificationRepository.Update(record);
            }

            await _notificationRepository.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "发送告警通知异常: AlertId={AlertId}", alert.Id);
        }
    }

    private async Task<List<NotificationPreference>> GetNotificationPreferences(long? customerId, AlertSeverity severity)
    {
        var preferences = new List<NotificationPreference>();

        if (customerId.HasValue)
        {
            var customer = await _customerRepository.GetByIdAsync(customerId.Value);
            if (customer != null && customer.NotificationPreferences != null)
            {
                preferences.AddRange(customer.NotificationPreferences
                    .Where(p => p.IsEnabled && p.Severity == severity));
            }
        }

        if (preferences.Count == 0)
        {
            preferences.Add(new NotificationPreference
            {
                Channel = NotificationChannel.InApp,
                Recipient = "system",
                Severity = severity,
                IsEnabled = true,
                EscalationLevel = 1,
                EscalationTimeoutMinutes = 30
            });
        }

        return preferences;
    }

    private string GenerateSubject(Alert alert)
    {
        var severityText = alert.Severity switch
        {
            AlertSeverity.Fatal => "【致命】",
            AlertSeverity.Critical => "【严重】",
            AlertSeverity.Warning => "【警告】",
            AlertSeverity.Info => "【提示】",
            _ => "【告警】"
        };
        return $"{severityText}冷链温控告警 - {alert.Title}";
    }

    private string GenerateContent(Alert alert)
    {
        return $@"
告警编号: {alert.AlertCode}
告警规则: {alert.Title}
严重等级: {alert.Severity}
首次触发: {alert.FirstTriggeredAt:yyyy-MM-dd HH:mm:ss}
触发次数: {alert.TriggerCount}
触发指标: {alert.TriggerMetric}
触发数值: {alert.TriggerValue}
详细描述: {alert.Description}

请及时处理此告警。
";
    }

    private Task SendNotificationAsync(NotificationChannel channel, string recipient, string subject, string content)
    {
        switch (channel)
        {
            case NotificationChannel.InApp:
                return SendInAppNotificationAsync(recipient, subject, content);
            case NotificationChannel.Sms:
                return SendSmsNotificationAsync(recipient, subject, content);
            case NotificationChannel.Email:
                return SendEmailNotificationAsync(recipient, subject, content);
            default:
                return Task.CompletedTask;
        }
    }

    private Task SendInAppNotificationAsync(string recipient, string subject, string content)
    {
        Log.Information("[站内消息] 发送给 {Recipient}: {Subject}", recipient, subject);
        return Task.CompletedTask;
    }

    private Task SendSmsNotificationAsync(string phoneNumber, string subject, string content)
    {
        Log.Information("[短信] 发送给 {Phone}: {Subject}", phoneNumber, subject);
        return Task.CompletedTask;
    }

    private Task SendEmailNotificationAsync(string email, string subject, string content)
    {
        Log.Information("[邮件] 发送给 {Email}: {Subject}", email, subject);
        return Task.CompletedTask;
    }

    public async Task ProcessEscalationAsync()
    {
        Log.Information("开始处理告警升级");

        var now = DateTime.UtcNow;
        var alertsToEscalate = await _alertRepository.GetAlertsForEscalationAsync(now);

        Log.Information("发现 {Count} 条需要升级的告警", alertsToEscalate.Count);

        foreach (var alert in alertsToEscalate)
        {
            try
            {
                alert.EscalationLevel++;
                alert.IsEscalated = true;
                alert.Status = AlertStatus.Escalated;

                var escalationRecord = new NotificationRecord
                {
                    AlertId = alert.Id,
                    CustomerId = alert.CustomerId,
                    Channel = NotificationChannel.InApp,
                    Recipient = "admin",
                    Subject = $"【升级告警】{alert.Title}",
                    Content = $"告警 {alert.AlertCode} 已升级至第 {alert.EscalationLevel} 级，请高级管理人员立即处理。\n\n原告警内容:\n{GenerateContent(alert)}",
                    IsSent = true,
                    SentAt = DateTime.UtcNow,
                    RetryCount = 0,
                    EscalationLevel = alert.EscalationLevel
                };

                await _notificationRepository.AddAsync(escalationRecord);
                _alertRepository.Update(alert);

                Log.Warning("告警升级: AlertId={AlertId}, 当前级别={Level}", alert.Id, alert.EscalationLevel);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "告警升级处理失败: AlertId={AlertId}", alert.Id);
            }
        }

        await _alertRepository.SaveChangesAsync();
        await _notificationRepository.SaveChangesAsync();

        Log.Information("告警升级处理完成");
    }

    public async Task RetryFailedNotificationsAsync()
    {
        var pending = await _notificationRepository.GetPendingNotificationsAsync();
        Log.Information("发现 {Count} 条待重试的通知", pending.Count);

        foreach (var record in pending)
        {
            try
            {
                await SendNotificationAsync(record.Channel, record.Recipient, record.Subject, record.Content ?? string.Empty);
                record.IsSent = true;
                record.SentAt = DateTime.UtcNow;
                record.ErrorMessage = null;
                Log.Information("通知重试成功: NotificationId={Id}", record.Id);
            }
            catch (Exception ex)
            {
                record.RetryCount++;
                record.ErrorMessage = ex.Message;
                Log.Warning(ex, "通知重试失败: NotificationId={Id}, 重试次数={RetryCount}", record.Id, record.RetryCount);
            }
            _notificationRepository.Update(record);
        }

        await _notificationRepository.SaveChangesAsync();
    }
}
