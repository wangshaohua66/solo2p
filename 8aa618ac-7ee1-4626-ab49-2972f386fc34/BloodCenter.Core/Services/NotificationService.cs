using System.Collections.Concurrent;
using BloodCenter.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace BloodCenter.Core.Services;

public class NotificationService : INotificationService
{
    private readonly ILogger<NotificationService> _logger;
    private readonly ConcurrentQueue<NotificationMessage> _notificationQueue;

    public NotificationService(ILogger<NotificationService> logger)
    {
        _logger = logger;
        _notificationQueue = new ConcurrentQueue<NotificationMessage>();
    }

    public Task SendInventoryAlertAsync(string alertType, string message, string severity, CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow;
        var metadata = new Dictionary<string, string>
        {
            ["Timestamp"] = timestamp.ToString("o"),
            ["Severity"] = severity,
            ["AlertType"] = alertType
        };

        var notification = new NotificationMessage(
            Type: "InventoryAlert",
            Recipient: "InventoryManager",
            Subject: $"Inventory Alert: {alertType}",
            Body: message,
            Channel: NotificationChannel.MessageQueue.ToString(),
            Metadata: metadata);

        _logger.LogInformation(
            "Inventory alert sent - Type: {AlertType}, Severity: {Severity}, Message: {Message}",
            alertType, severity, message);

        _notificationQueue.Enqueue(notification);

        return Task.CompletedTask;
    }

    public Task SendDonorRecallAsync(Guid donorId, string donorName, string phoneNumber, DateTime nextEligibleDate, CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow;
        var metadata = new Dictionary<string, string>
        {
            ["Timestamp"] = timestamp.ToString("o"),
            ["Severity"] = "Information",
            ["DonorId"] = donorId.ToString(),
            ["NextEligibleDate"] = nextEligibleDate.ToString("o")
        };

        var notification = new NotificationMessage(
            Type: "DonorRecall",
            Recipient: $"{donorName} ({phoneNumber})",
            Subject: "Blood Donation Recall",
            Body: $"Dear {donorName}, you are eligible to donate blood again after {nextEligibleDate:yyyy-MM-dd}. Please consider scheduling a donation appointment.",
            Channel: NotificationChannel.Sms.ToString(),
            Metadata: metadata);

        _logger.LogInformation(
            "Donor recall sent - DonorId: {DonorId}, DonorName: {DonorName}, Phone: {PhoneNumber}, NextEligibleDate: {NextEligibleDate}",
            donorId, donorName, phoneNumber, nextEligibleDate);

        _notificationQueue.Enqueue(notification);

        return Task.CompletedTask;
    }

    public Task SendBloodRequestNotificationAsync(Guid requestId, string hospitalName, string status, CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow;
        var metadata = new Dictionary<string, string>
        {
            ["Timestamp"] = timestamp.ToString("o"),
            ["Severity"] = "High",
            ["RequestId"] = requestId.ToString(),
            ["Status"] = status
        };

        var notification = new NotificationMessage(
            Type: "BloodRequest",
            Recipient: hospitalName,
            Subject: $"Blood Request Update: {status}",
            Body: $"Your blood request (ID: {requestId}) has been updated to status: {status}",
            Channel: NotificationChannel.Email.ToString(),
            Metadata: metadata);

        _logger.LogInformation(
            "Blood request notification sent - RequestId: {RequestId}, Hospital: {HospitalName}, Status: {Status}",
            requestId, hospitalName, status);

        _notificationQueue.Enqueue(notification);

        return Task.CompletedTask;
    }

    public Task SendTestResultNotificationAsync(Guid donationId, string result, CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow;
        var severity = result.Equals("Positive", StringComparison.OrdinalIgnoreCase) || result.Equals("Reactive", StringComparison.OrdinalIgnoreCase)
            ? "High"
            : "Information";

        var metadata = new Dictionary<string, string>
        {
            ["Timestamp"] = timestamp.ToString("o"),
            ["Severity"] = severity,
            ["DonationId"] = donationId.ToString(),
            ["Result"] = result
        };

        var notification = new NotificationMessage(
            Type: "TestResult",
            Recipient: "LabManager",
            Subject: $"Test Result Available for Donation {donationId}",
            Body: $"Test results for donation {donationId} are now available. Result: {result}",
            Channel: NotificationChannel.InApp.ToString(),
            Metadata: metadata);

        _logger.LogInformation(
            "Test result notification sent - DonationId: {DonationId}, Result: {Result}, Severity: {Severity}",
            donationId, result, severity);

        _notificationQueue.Enqueue(notification);

        return Task.CompletedTask;
    }

    public IReadOnlyCollection<NotificationMessage> GetQueuedNotifications()
    {
        return _notificationQueue.ToArray();
    }

    public bool TryDequeueNotification(out NotificationMessage? notification)
    {
        return _notificationQueue.TryDequeue(out notification);
    }
}
