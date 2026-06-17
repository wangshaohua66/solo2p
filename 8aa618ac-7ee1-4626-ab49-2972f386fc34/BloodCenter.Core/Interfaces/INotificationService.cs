namespace BloodCenter.Core.Interfaces;

public interface INotificationService
{
    Task SendInventoryAlertAsync(string alertType, string message, string severity, CancellationToken cancellationToken = default);
    Task SendDonorRecallAsync(Guid donorId, string donorName, string phoneNumber, DateTime nextEligibleDate, CancellationToken cancellationToken = default);
    Task SendBloodRequestNotificationAsync(Guid requestId, string hospitalName, string status, CancellationToken cancellationToken = default);
    Task SendTestResultNotificationAsync(Guid donationId, string result, CancellationToken cancellationToken = default);
}

public record NotificationMessage(
    string Type,
    string Recipient,
    string Subject,
    string Body,
    string? Channel = null,
    IDictionary<string, string>? Metadata = null);

public enum NotificationChannel
{
    Email = 1,
    Sms = 2,
    InApp = 3,
    MessageQueue = 4
}
