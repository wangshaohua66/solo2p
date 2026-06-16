using Microsoft.Extensions.Logging;

namespace EvidenceManagementSystem.Services;

public class EmailSender : IEmailSender
{
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(ILogger<EmailSender> logger)
    {
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string subject, string body)
    {
        if (string.IsNullOrEmpty(toEmail))
        {
            _logger.LogWarning("邮件收件人为空，跳过发送。主题: {Subject}", subject);
            return;
        }

        _logger.LogInformation("[邮件] 发送至 {Email} | 主题: {Subject} | 正文: {Body}",
            toEmail, subject, body);

        await Task.CompletedTask;
    }
}
