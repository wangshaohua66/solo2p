using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MailKit.Net.Smtp;
using MimeKit;
using Microsoft.Extensions.Options;
using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.Common;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class NotificationService : INotificationService
{
    private readonly INotificationRecordRepository _notificationRepository;
    private readonly IAlertRepository _alertRepository;
    private readonly INotificationPreferenceRepository _preferenceRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly EmailSettings _emailSettings;
    private readonly SmsSettings _smsSettings;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly bool _isEmailConfigured;
    private readonly bool _isSmsConfigured;

    public NotificationService(
        INotificationRecordRepository notificationRepository,
        IAlertRepository alertRepository,
        INotificationPreferenceRepository preferenceRepository,
        ICustomerRepository customerRepository,
        IOptions<EmailSettings> emailSettings,
        IOptions<SmsSettings> smsSettings,
        IHttpClientFactory httpClientFactory)
    {
        _notificationRepository = notificationRepository;
        _alertRepository = alertRepository;
        _preferenceRepository = preferenceRepository;
        _customerRepository = customerRepository;
        _emailSettings = emailSettings.Value;
        _smsSettings = smsSettings.Value;
        _httpClientFactory = httpClientFactory;

        _isEmailConfigured = !string.IsNullOrWhiteSpace(_emailSettings.SmtpServer)
            && !string.IsNullOrWhiteSpace(_emailSettings.Username)
            && !string.IsNullOrWhiteSpace(_emailSettings.Password);

        _isSmsConfigured = !string.IsNullOrWhiteSpace(_smsSettings.AccessKeyId)
            && !string.IsNullOrWhiteSpace(_smsSettings.AccessKeySecret)
            && !string.IsNullOrWhiteSpace(_smsSettings.SignName)
            && !string.IsNullOrWhiteSpace(_smsSettings.TemplateCode);
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
                    await SendNotificationAsync(preference.Channel, record.Recipient, record.Subject, record.Content!);
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

    private async Task SendNotificationAsync(NotificationChannel channel, string recipient, string subject, string content)
    {
        switch (channel)
        {
            case NotificationChannel.InApp:
                await SendInAppNotificationAsync(recipient, subject, content);
                break;
            case NotificationChannel.Sms:
                await SendSmsNotificationAsync(recipient, subject, content);
                break;
            case NotificationChannel.Email:
                await SendEmailNotificationAsync(recipient, subject, content);
                break;
        }
    }

    private Task SendInAppNotificationAsync(string recipient, string subject, string content)
    {
        Log.Information("[站内消息] 发送给 {Recipient}: {Subject}", recipient, subject);
        return Task.CompletedTask;
    }

    private async Task SendSmsNotificationAsync(string phoneNumber, string subject, string content)
    {
        if (!_isSmsConfigured)
        {
            Log.Warning("[短信] SMS 配置不完整，降级为日志输出: 发送给 {Phone}: {Subject}", phoneNumber, subject);
            Log.Information("[短信内容] {Content}", content?.Trim());
            return;
        }

        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            throw new ArgumentException("手机号码不能为空");
        }

        var cleanPhone = phoneNumber.Replace("+", "").Replace(" ", "").Replace("-", "");

        var templateParam = JsonSerializer.Serialize(new
        {
            subject = subject,
            content = content?.Length > 100 ? content.Substring(0, 100) + "..." : content
        });

        var requestParams = new SortedDictionary<string, string>
        {
            { "Action", "SendSms" },
            { "Version", "2017-05-25" },
            { "RegionId", "cn-hangzhou" },
            { "PhoneNumbers", cleanPhone },
            { "SignName", _smsSettings.SignName },
            { "TemplateCode", _smsSettings.TemplateCode },
            { "TemplateParam", templateParam },
            { "Timestamp", DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ") },
            { "Format", "JSON" },
            { "SignatureMethod", "HMAC-SHA1" },
            { "SignatureVersion", "1.0" },
            { "SignatureNonce", Guid.NewGuid().ToString() },
            { "AccessKeyId", _smsSettings.AccessKeyId }
        };

        var signature = ComputeAliyunSignature(requestParams, _smsSettings.AccessKeySecret);
        requestParams["Signature"] = signature;

        var queryString = string.Join("&", requestParams.Select(kvp =>
            $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}"));

        using var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(_smsSettings.TimeoutSeconds);

        var requestUrl = $"https://{_smsSettings.Endpoint}/?{queryString}";

        var response = await client.GetAsync(requestUrl);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"SMS API 返回 {response.StatusCode}: {responseContent}");
        }

        using var jsonDoc = JsonDocument.Parse(responseContent);
        var root = jsonDoc.RootElement;
        if (root.TryGetProperty("Code", out var code) && code.GetString() != "OK")
        {
            var message = root.TryGetProperty("Message", out var msg) ? msg.GetString() : "未知错误";
            throw new InvalidOperationException($"SMS 发送失败: {code} - {message}");
        }

        Log.Information("[短信] 发送成功给 {Phone}", phoneNumber);
    }

    private string ComputeAliyunSignature(SortedDictionary<string, string> parameters, string accessKeySecret)
    {
        var canonicalizedQueryString = string.Join("&",
            parameters.Select(kvp =>
                $"{PercentEncode(kvp.Key)}={PercentEncode(kvp.Value)}"));

        var stringToSign = $"GET&%2F&{PercentEncode(canonicalizedQueryString)}";

        using var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(accessKeySecret + "&"));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(stringToSign));
        return Convert.ToBase64String(hashBytes);
    }

    private string PercentEncode(string value)
    {
        var encoded = Uri.EscapeDataString(value);
        return encoded
            .Replace("+", "%20")
            .Replace("*", "%2A")
            .Replace("%7E", "~");
    }

    private async Task SendEmailNotificationAsync(string email, string subject, string content)
    {
        if (!_isEmailConfigured)
        {
            Log.Warning("[邮件] SMTP 配置不完整，降级为日志输出: 发送给 {Email}: {Subject}", email, subject);
            Log.Information("[邮件内容] {Content}", content?.Trim());
            return;
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("邮箱地址不能为空");
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_emailSettings.SenderName, _emailSettings.SenderEmail));
        message.To.Add(MailboxAddress.Parse(email));
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            TextBody = content?.Trim()
        };
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        try
        {
            await client.ConnectAsync(
                _emailSettings.SmtpServer,
                _emailSettings.SmtpPort,
                _emailSettings.EnableSsl);

            if (!string.IsNullOrWhiteSpace(_emailSettings.Username))
            {
                await client.AuthenticateAsync(_emailSettings.Username, _emailSettings.Password);
            }

            client.Timeout = _emailSettings.TimeoutSeconds * 1000;

            await client.SendAsync(message);
            Log.Information("[邮件] 发送成功给 {Email}: {Subject}", email, subject);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "[邮件] 发送失败给 {Email}", email);
            throw;
        }
        finally
        {
            try { await client.DisconnectAsync(true); } catch { }
        }
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
                await SendNotificationAsync(record.Channel, record.Recipient, record.Subject ?? string.Empty, record.Content ?? string.Empty);
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
