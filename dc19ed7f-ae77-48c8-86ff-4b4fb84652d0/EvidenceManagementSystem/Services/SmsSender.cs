using Microsoft.Extensions.Logging;

namespace EvidenceManagementSystem.Services;

public class SmsSender : ISmsSender
{
    private readonly ILogger<SmsSender> _logger;

    public SmsSender(ILogger<SmsSender> logger)
    {
        _logger = logger;
    }

    public async Task SendAsync(string phoneNumber, string message)
    {
        if (string.IsNullOrEmpty(phoneNumber))
        {
            _logger.LogWarning("短信手机号为空，跳过发送。");
            return;
        }

        _logger.LogInformation("[短信] 发送至 {Phone} | 内容: {Message}",
            phoneNumber, message);

        await Task.CompletedTask;
    }
}
