namespace EvidenceManagementSystem.Services;

public interface INotificationService
{
    Task SendEmailAsync(string toEmail, string subject, string body);
    Task SendSmsAsync(string phoneNumber, string message);
    Task NotifyLeaderAsync(string leaderRole, string title, string content);
    Task NotifyUserAsync(Guid userId, string title, string content);
}
