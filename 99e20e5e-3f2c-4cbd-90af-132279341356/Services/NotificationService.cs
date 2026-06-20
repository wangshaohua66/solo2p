using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Repositories;

namespace FireIoTPlatform.Services;

public class NotificationService : INotificationService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IUnitOfWork unitOfWork, IHttpClientFactory httpClientFactory,
        IConfiguration config, ILogger<NotificationService> logger)
    {
        _unitOfWork = unitOfWork;
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<bool> SendSmsAsync(string phoneNumber, string message)
    {
        if (string.IsNullOrEmpty(phoneNumber))
        {
            _logger.LogWarning("短信发送失败：手机号为空");
            return false;
        }

        var smsApiUrl = _config["NotificationSettings:SmsApiUrl"];
        var smsApiKey = _config["NotificationSettings:SmsApiKey"];

        if (string.IsNullOrEmpty(smsApiUrl))
        {
            _logger.LogInformation($"[模拟短信发送] 号码: {phoneNumber}, 内容: {message}");
            return true;
        }

        try
        {
            using var client = _httpClientFactory.CreateClient();
            var payload = new
            {
                apiKey = smsApiKey,
                phone = phoneNumber,
                content = message,
                template = "fire_alarm"
            };

            var json = Newtonsoft.Json.JsonConvert.SerializeObject(payload);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var response = await client.PostAsync(smsApiUrl, content);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation($"短信发送成功: {phoneNumber}");
                return true;
            }
            else
            {
                _logger.LogError($"短信发送失败: {phoneNumber}, StatusCode: {response.StatusCode}");
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"短信发送异常: {phoneNumber}");
            return false;
        }
    }

    public async Task<bool> SendPhoneCallAsync(string phoneNumber, string alertInfo)
    {
        if (string.IsNullOrEmpty(phoneNumber))
        {
            _logger.LogWarning("电话通知失败：手机号为空");
            return false;
        }

        var callApiUrl = _config["NotificationSettings:CallApiUrl"];
        var callApiKey = _config["NotificationSettings:CallApiKey"];

        if (string.IsNullOrEmpty(callApiUrl))
        {
            _logger.LogInformation($"[模拟电话通知] 号码: {phoneNumber}, 内容: {alertInfo}");
            return true;
        }

        try
        {
            using var client = _httpClientFactory.CreateClient();
            var payload = new
            {
                apiKey = callApiKey,
                phone = phoneNumber,
                content = alertInfo,
                template = "fire_emergency_call",
                repeatCount = 2
            };

            var json = Newtonsoft.Json.JsonConvert.SerializeObject(payload);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var response = await client.PostAsync(callApiUrl, content);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation($"电话通知成功: {phoneNumber}");
                return true;
            }
            else
            {
                _logger.LogError($"电话通知失败: {phoneNumber}, StatusCode: {response.StatusCode}");
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"电话通知异常: {phoneNumber}");
            return false;
        }
    }

    public async Task<bool> SendBatchSmsAsync(List<string> phoneNumbers, string message)
    {
        if (phoneNumbers == null || !phoneNumbers.Any()) return false;

        var tasks = phoneNumbers.Distinct().Select(p => SendSmsAsync(p, message)).ToList();
        var results = await Task.WhenAll(tasks);
        var successCount = results.Count(r => r);

        _logger.LogInformation($"批量短信发送完成: 总数{phoneNumbers.Count}, 成功{successCount}");
        return successCount > 0;
    }

    public async Task<bool> SendAlarmNotificationsAsync(long alarmId, string alarmType, string unitName, string location, string level)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(alarmId);
        if (alarm == null) return false;

        var unit = await _unitOfWork.FireUnits.GetByIdAsync(alarm.FireUnitId);

        var supervisors = await _unitOfWork.Users.FindAsync(u =>
            !u.IsDeleted && u.IsActive &&
            (u.Role == Models.Enums.UserRole.Supervisor || u.Role == Models.Enums.UserRole.Administrator));

        var phoneNumbers = supervisors
            .Where(u => !string.IsNullOrEmpty(u.Phone))
            .Select(u => u.Phone!)
            .Distinct()
            .ToList();

        if (unit != null && !string.IsNullOrEmpty(unit.FireSafetyManagerPhone))
            phoneNumbers.Add(unit.FireSafetyManagerPhone);
        if (unit != null && !string.IsNullOrEmpty(unit.ContactPhone))
            phoneNumbers.Add(unit.ContactPhone);

        var smsMessage = $"【消防告警】{level}级-{alarmType}\n单位: {unitName}\n位置: {location}\n告警时间: {alarm.AlarmTime:yyyy-MM-dd HH:mm:ss}\n请立即处理！";

        var callMessage = $"紧急火警警报！{level}级{alarmType}发生在{unitName}，位置{location}，请立即处理！";

        await SendBatchSmsAsync(phoneNumbers, smsMessage);

        if (level == "紧急" || level == "严重")
        {
            var callTargets = supervisors
                .Where(u => u.Role == Models.Enums.UserRole.Supervisor && !string.IsNullOrEmpty(u.Phone))
                .Take(3)
                .Select(u => u.Phone!)
                .ToList();

            foreach (var phone in callTargets)
            {
                _ = Task.Run(async () =>
                {
                    await Task.Delay(1000);
                    await SendPhoneCallAsync(phone, callMessage);
                });
            }
        }

        _logger.LogInformation($"告警通知已发送: AlarmId={alarmId}, 接收人数={phoneNumbers.Distinct().Count()}");
        return true;
    }

    public async Task<bool> SendDispatchNotificationsAsync(long dispatchId, string stationName, string location, string fireType)
    {
        var dispatch = await _unitOfWork.RescueDispatches.GetByIdAsync(dispatchId);
        if (dispatch == null) return false;

        var firefighters = await _unitOfWork.Firefighters.FindAsync(f =>
            f.FireStationId == dispatch.FireStationId && f.IsOnDuty && f.IsActive);

        var phoneNumbers = firefighters
            .Where(f => !string.IsNullOrEmpty(f.Phone))
            .Select(f => f.Phone!)
            .Distinct()
            .ToList();

        var station = await _unitOfWork.FireStations.GetByIdAsync(dispatch.FireStationId);
        if (!string.IsNullOrEmpty(station?.ContactPhone))
            phoneNumbers.Add(station.ContactPhone);

        var smsMessage = $"【出警通知】{fireType}\n地点: {location}\n时间: {dispatch.DispatchTime:yyyy-MM-dd HH:mm:ss}\n请{stationName}消防站立即出警！";

        var callMessage = $"紧急出警通知！{stationName}消防站请立即出动，{fireType}发生在{location}！";

        await SendBatchSmsAsync(phoneNumbers, smsMessage);

        var callTargets = firefighters
            .Where(f => !string.IsNullOrEmpty(f.Phone))
            .Take(5)
            .Select(f => f.Phone!)
            .ToList();

        foreach (var phone in callTargets)
        {
            _ = Task.Run(async () =>
            {
                await Task.Delay(500);
                await SendPhoneCallAsync(phone, callMessage);
            });
        }

        _logger.LogInformation($"调度通知已发送: DispatchId={dispatchId}, 接收人数={phoneNumbers.Distinct().Count()}");
        return true;
    }
}
