namespace FireIoTPlatform.Services;

public interface INotificationService
{
    Task<bool> SendSmsAsync(string phoneNumber, string message);
    Task<bool> SendPhoneCallAsync(string phoneNumber, string alertInfo);
    Task<bool> SendBatchSmsAsync(List<string> phoneNumbers, string message);
    Task<bool> SendAlarmNotificationsAsync(long alarmId, string alarmType, string unitName, string location, string level);
    Task<bool> SendDispatchNotificationsAsync(long dispatchId, string stationName, string location, string fireType);
}
