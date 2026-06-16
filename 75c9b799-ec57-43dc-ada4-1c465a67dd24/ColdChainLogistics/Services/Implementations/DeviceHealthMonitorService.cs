using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class DeviceHealthMonitorService : IDeviceHealthMonitorService
{
    private readonly ISensorRepository _sensorRepository;
    private readonly IAlertRepository _alertRepository;
    private readonly INotificationService _notificationService;
    private readonly IDeviceMaintenanceWindowRepository _maintenanceWindowRepository;

    public DeviceHealthMonitorService(
        ISensorRepository sensorRepository,
        IAlertRepository alertRepository,
        INotificationService notificationService,
        IDeviceMaintenanceWindowRepository maintenanceWindowRepository)
    {
        _sensorRepository = sensorRepository;
        _alertRepository = alertRepository;
        _notificationService = notificationService;
        _maintenanceWindowRepository = maintenanceWindowRepository;
    }

    public async Task CheckDeviceHealthAsync()
    {
        Log.Information("开始设备健康检查");

        var activeSensors = await _sensorRepository.GetActiveSensorsAsync();
        var offlineSensors = new List<Sensor>();
        var now = DateTime.UtcNow;

        foreach (var sensor in activeSensors)
        {
            if (sensor.Status != SensorStatus.Active)
                continue;

            if (await IsInMaintenanceWindowAsync(sensor.Id, now))
            {
                Log.Debug("传感器 {SensorCode} 处于维护窗口期，跳过健康检查", sensor.SensorCode);
                continue;
            }

            var offlineThreshold = TimeSpan.FromMinutes(sensor.OfflineThresholdMinutes);
            var lastReportTime = sensor.LastReportTime ?? sensor.CreatedAt;

            if (now - lastReportTime > offlineThreshold)
            {
                offlineSensors.Add(sensor);
                await MarkSensorOfflineAsync(sensor.Id);
            }
        }

        Log.Information("设备健康检查完成，发现 {Count} 个离线传感器", offlineSensors.Count);
    }

    public async Task MarkSensorOfflineAsync(long sensorId)
    {
        var sensor = await _sensorRepository.GetByIdAsync(sensorId);
        if (sensor == null || sensor.Status == SensorStatus.Offline)
            return;

        sensor.Status = SensorStatus.Offline;
        sensor.UpdatedAt = DateTime.UtcNow;
        _sensorRepository.Update(sensor);
        await _sensorRepository.SaveChangesAsync();

        Log.Warning("传感器 {SensorCode} 已标记为离线", sensor.SensorCode);

        var existingAlert = await _alertRepository.GetActiveAlertCountBySensorIdAsync(sensorId, -1);
        if (existingAlert == 0)
        {
            var alert = new Alert
            {
                AlertCode = GenerateAlertCode(),
                AlertRuleId = 0,
                CustomerId = null,
                VehicleId = sensor.VehicleId,
                SensorId = sensor.Id,
                ShipmentId = null,
                Severity = AlertSeverity.Warning,
                Status = AlertStatus.New,
                Title = $"传感器离线告警 - {sensor.SensorCode}",
                Description = $"传感器 {sensor.SensorCode} (设备ID: {sensor.DeviceId}) 已超过 {sensor.OfflineThresholdMinutes} 分钟未上报数据，可能设备故障或网络异常。",
                FirstTriggeredAt = DateTime.UtcNow,
                LastTriggeredAt = DateTime.UtcNow,
                TriggerCount = 1,
                TriggerMetric = "offline",
                TriggerValue = sensor.OfflineThresholdMinutes,
                EscalationLevel = 1,
                NextEscalationAt = DateTime.UtcNow.AddMinutes(30),
                IsEscalated = false
            };

            await _alertRepository.AddAsync(alert);
            await _alertRepository.SaveChangesAsync();

            _ = Task.Run(() => _notificationService.SendAlertNotificationAsync(alert));
        }
    }

    public async Task<bool> IsInMaintenanceWindowAsync(long sensorId, DateTime time)
    {
        var windows = await _maintenanceWindowRepository.GetBySensorIdAsync(sensorId);
        return windows.Any(w => w.StartTime <= time && w.EndTime >= time);
    }

    private string GenerateAlertCode()
    {
        return $"ALT{DateTime.UtcNow:yyyyMMddHHmmssfff}{new Random().Next(1000, 9999)}";
    }
}
