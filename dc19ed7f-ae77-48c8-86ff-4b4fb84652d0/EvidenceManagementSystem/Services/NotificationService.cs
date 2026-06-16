using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;
using Microsoft.Extensions.Logging;

namespace EvidenceManagementSystem.Services;

public class NotificationService : INotificationService
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IUserRepository userRepository,
        ILogger<NotificationService> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        if (string.IsNullOrEmpty(toEmail))
        {
            _logger.LogWarning("邮件收件人为空，跳过发送。主题: {Subject}", subject);
            return;
        }

        _logger.LogInformation("发送邮件至 {Email}，主题: {Subject}", toEmail, subject);

        await Task.CompletedTask;
    }

    public async Task SendSmsAsync(string phoneNumber, string message)
    {
        if (string.IsNullOrEmpty(phoneNumber))
        {
            _logger.LogWarning("短信手机号为空，跳过发送。");
            return;
        }

        _logger.LogInformation("发送短信至 {Phone}，内容: {Message}", phoneNumber, message);

        await Task.CompletedTask;
    }

    public async Task NotifyLeaderAsync(string leaderRole, string title, string content)
    {
        var leaders = await _userRepository.GetByRoleAsync(UserRole.Leader);

        foreach (var leader in leaders)
        {
            _logger.LogInformation("通知分管领导 {LeaderName}({LeaderId})：{Title}",
                leader.RealName, leader.Id, title);

            if (!string.IsNullOrEmpty(leader.Email))
            {
                await SendEmailAsync(leader.Email, title, content);
            }

            if (!string.IsNullOrEmpty(leader.Phone))
            {
                await SendSmsAsync(leader.Phone, $"[物证管理系统]{title}：{content}");
            }
        }
    }

    public async Task NotifyUserAsync(Guid userId, string title, string content)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("通知用户不存在: {UserId}", userId);
            return;
        }

        _logger.LogInformation("通知用户 {UserName}({UserId})：{Title}",
            user.RealName, user.Id, title);

        if (!string.IsNullOrEmpty(user.Email))
        {
            await SendEmailAsync(user.Email, title, content);
        }

        if (!string.IsNullOrEmpty(user.Phone))
        {
            await SendSmsAsync(user.Phone, $"[物证管理系统]{title}：{content}");
        }
    }
}
