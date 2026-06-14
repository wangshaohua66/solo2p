using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.Services;

public class MonitorService
{
    private readonly ITemperatureReadingRepository _readingRepository;
    private readonly IDeviceRepository _deviceRepository;
    private readonly ITransportTaskRepository _taskRepository;
    private readonly AlertRuleEngine _ruleEngine;
    private readonly AlertService _alertService;

    public MonitorService(
        ITemperatureReadingRepository readingRepository,
        IDeviceRepository deviceRepository,
        ITransportTaskRepository taskRepository,
        AlertRuleEngine ruleEngine,
        AlertService alertService)
    {
        _readingRepository = readingRepository;
        _deviceRepository = deviceRepository;
        _taskRepository = taskRepository;
        _ruleEngine = ruleEngine;
        _alertService = alertService;
    }

    public async Task ReportTemperatureAsync(TemperatureReportRequest request)
    {
        var timestamp = request.Timestamp ?? DateTime.UtcNow;

        GpsLocation? location = null;
        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            location = new GpsLocation
            {
                Latitude = request.Latitude.Value,
                Longitude = request.Longitude.Value,
                Accuracy = request.Accuracy,
                Timestamp = timestamp
            };
        }

        var device = await _deviceRepository.GetByDeviceIdAsync(request.DeviceId);
        if (device == null)
        {
            return;
        }

        var activeTasks = await _taskRepository.GetActiveTasksByDeviceIdAsync(request.DeviceId);
        var transportTaskId = activeTasks.FirstOrDefault()?.Id;

        var reading = new TemperatureReading
        {
            DeviceId = request.DeviceId,
            Timestamp = timestamp,
            Temperature = request.Temperature,
            Humidity = request.Humidity,
            Location = location,
            BatteryLevel = request.BatteryLevel,
            SignalStrength = request.SignalStrength,
            TransportTaskId = transportTaskId,
            ReceivedAt = DateTime.UtcNow
        };

        var alertResults = await _ruleEngine.EvaluateTemperatureAsync(
            request.DeviceId,
            request.Temperature,
            request.Humidity,
            timestamp,
            transportTaskId);

        reading.IsAnomaly = alertResults.Count > 0;

        await _readingRepository.AddAsync(reading);

        await _deviceRepository.UpdateLastReportAsync(
            request.DeviceId,
            timestamp,
            request.BatteryLevel,
            location);

        if (device.Status == DeviceStatus.Offline || device.Status == DeviceStatus.LowBattery)
        {
            await _deviceRepository.UpdateStatusAsync(request.DeviceId, DeviceStatus.Active);
        }

        foreach (var alertResult in alertResults)
        {
            await ProcessAlertAsync(alertResult, device, transportTaskId, location);
        }

        if (request.BatteryLevel.HasValue && request.BatteryLevel <= device.LowBatteryThreshold)
        {
            if (device.Status != DeviceStatus.LowBattery)
            {
                await _deviceRepository.UpdateStatusAsync(request.DeviceId, DeviceStatus.LowBattery);
            }
        }
    }

    public async Task<List<RealTimeMonitorDto>> GetRealTimeStatusAsync(string? deviceId = null, string? vehicleId = null)
    {
        List<Device> devices;
        if (!string.IsNullOrEmpty(deviceId))
        {
            var device = await _deviceRepository.GetByDeviceIdAsync(deviceId);
            devices = device != null ? new List<Device> { device } : new List<Device>();
        }
        else if (!string.IsNullOrEmpty(vehicleId))
        {
            devices = await _deviceRepository.GetByVehicleIdAsync(vehicleId);
        }
        else
        {
            devices = await _deviceRepository.GetAllAsync();
        }

        var deviceIds = devices.Select(d => d.DeviceId).ToList();
        var latestReadings = await _readingRepository.GetLatestByDeviceIdsAsync(deviceIds);

        var result = new List<RealTimeMonitorDto>();
        foreach (var device in devices)
        {
            var latestReading = latestReadings.FirstOrDefault(r => r.DeviceId == device.DeviceId);
            var isOnline = device.LastReportAt.HasValue &&
                           device.Status == DeviceStatus.Active &&
                           (DateTime.UtcNow - device.LastReportAt.Value).TotalMinutes <= device.OfflineThresholdMinutes;

            var activeTasks = await _taskRepository.GetActiveTasksByDeviceIdAsync(device.DeviceId);
            var activeTask = activeTasks.FirstOrDefault();

            result.Add(new RealTimeMonitorDto
            {
                DeviceId = device.DeviceId,
                DeviceName = device.DeviceName,
                VehicleId = device.VehicleId,
                VehiclePlate = device.VehiclePlate,
                CurrentTemperature = latestReading?.Temperature ?? 0,
                CurrentHumidity = latestReading?.Humidity,
                BatteryLevel = latestReading?.BatteryLevel ?? device.BatteryLevel,
                LastReportAt = latestReading?.Timestamp ?? device.LastReportAt ?? DateTime.UtcNow,
                Latitude = latestReading?.Location?.Latitude ?? device.LastKnownLocation?.Latitude,
                Longitude = latestReading?.Location?.Longitude ?? device.LastKnownLocation?.Longitude,
                IsOnline = isOnline,
                HasAlert = false,
                TransportTaskId = activeTask?.Id,
                TaskNo = activeTask?.TaskNo
            });
        }

        return result;
    }

    public async Task<CursorPagedResult<TemperatureReadingDto>> GetTemperatureHistoryAsync(TemperatureHistoryQuery query)
    {
        var result = await _readingRepository.GetPagedByDeviceAsync(
            query.DeviceId,
            query.StartTime,
            query.EndTime,
            query.Cursor,
            query.Limit);

        return new CursorPagedResult<TemperatureReadingDto>
        {
            Items = result.Items.Select(r => new TemperatureReadingDto
            {
                Id = r.Id,
                DeviceId = r.DeviceId,
                Timestamp = r.Timestamp,
                Temperature = r.Temperature,
                Humidity = r.Humidity,
                Latitude = r.Location?.Latitude,
                Longitude = r.Location?.Longitude,
                BatteryLevel = r.BatteryLevel,
                IsAnomaly = r.IsAnomaly
            }).ToList(),
            NextCursor = result.NextCursor,
            HasMore = result.HasMore,
            Limit = result.Limit,
            TotalCount = result.TotalCount
        };
    }

    public async Task<TemperatureStatsDto> GetTemperatureStatsAsync(string deviceId, DateTime startTime, DateTime endTime)
    {
        var stats = await _readingRepository.GetStatsAsync(deviceId, startTime, endTime);

        return new TemperatureStatsDto
        {
            DeviceId = deviceId,
            StartTime = startTime,
            EndTime = endTime,
            AvgTemperature = Math.Round(stats.avg, 2),
            MaxTemperature = stats.max,
            MinTemperature = stats.min,
            TotalRecords = stats.total,
            AnomalyRecords = stats.anomaly
        };
    }

    public async Task CheckDeviceOfflineStatusAsync()
    {
        var devices = await _deviceRepository.GetAllAsync();
        var now = DateTime.UtcNow;

        foreach (var device in devices)
        {
            if (device.Status == DeviceStatus.Inactive || device.Status == DeviceStatus.Faulty)
                continue;

            if (device.LastReportAt.HasValue)
            {
                var offlineDuration = now - device.LastReportAt.Value;
                if (offlineDuration.TotalMinutes >= device.OfflineThresholdMinutes)
                {
                    if (device.Status == DeviceStatus.Active)
                    {
                        await _deviceRepository.UpdateStatusAsync(device.DeviceId, DeviceStatus.Offline);

                        var offlineResults = await _ruleEngine.EvaluateDeviceStatusAsync(
                            device.DeviceId,
                            DeviceStatus.Offline,
                            device.BatteryLevel,
                            device.LastReportAt.Value,
                            now,
                            device.OfflineThresholdMinutes,
                            device.LowBatteryThreshold);

                        foreach (var alertResult in offlineResults)
                        {
                            await ProcessAlertAsync(alertResult, device, null, device.LastKnownLocation);
                        }
                    }
                }
            }
        }
    }

    private async Task ProcessAlertAsync(AlertMatchResult alertResult, Device device, string? taskId, GpsLocation? location)
    {
        var existingAlert = await _alertService.GetAlertsByTaskIdAsync(taskId ?? string.Empty);

        var alertNo = GenerateAlertNo();
        var message = GenerateAlertMessage(alertResult, device);

        var alert = new Alert
        {
            AlertNo = alertNo,
            AlertType = alertResult.Rule.AlertType,
            AlertLevel = alertResult.Rule.AlertLevel,
            DeviceId = alertResult.DeviceId,
            DeviceName = device.DeviceName,
            TransportTaskId = alertResult.TransportTaskId,
            Value = alertResult.Value,
            Threshold = alertResult.Rule.Threshold,
            DurationSeconds = alertResult.DurationSeconds,
            Location = location,
            Message = message,
            IsAcknowledged = false,
            IsResolved = false,
            FirstTriggeredAt = alertResult.FirstDetectedAt,
            LastTriggeredAt = DateTime.UtcNow,
            TriggerCount = 1,
            RuleId = alertResult.Rule.Id,
            CreatedAt = DateTime.UtcNow
        };

        var task = taskId != null ? await _taskRepository.GetByIdAsync(taskId) : null;
        if (task != null)
        {
            alert.TaskNo = task.TaskNo;
            var alertCount = task.AlertCount + 1;
            var criticalCount = task.CriticalAlertCount +
                (alertResult.Rule.AlertLevel == AlertLevel.Critical || alertResult.Rule.AlertLevel == AlertLevel.Fatal ? 1 : 0);
            await _taskRepository.UpdateAlertCountAsync(taskId!, alertCount, criticalCount);
        }

        await _alertService.CreateAlertAsync(alert);
    }

    private static string GenerateAlertMessage(AlertMatchResult result, Device device)
    {
        var type = result.Rule.AlertType;
        var value = Math.Round(result.Value, 2);
        var threshold = result.Rule.Threshold;

        return type switch
        {
            AlertType.TemperatureHigh => $"设备[{device.DeviceName}]温度过高: {value}°C, 阈值: {threshold}°C",
            AlertType.TemperatureLow => $"设备[{device.DeviceName}]温度过低: {value}°C, 阈值: {threshold}°C",
            AlertType.HumidityHigh => $"设备[{device.DeviceName}]湿度过高: {value}%, 阈值: {threshold}%",
            AlertType.HumidityLow => $"设备[{device.DeviceName}]湿度过低: {value}%, 阈值: {threshold}%",
            AlertType.DeviceOffline => $"设备[{device.DeviceName}]离线, 已超过{result.DurationSeconds / 60}分钟",
            AlertType.DeviceLowBattery => $"设备[{device.DeviceName}]低电量: {value}%, 阈值: {threshold}%",
            AlertType.DurationExceeded => $"设备[{device.DeviceName}]温度异常持续时长超限",
            _ => $"设备[{device.DeviceName}]发生异常"
        };
    }

    private static string GenerateAlertNo()
    {
        return $"ALT{DateTime.UtcNow:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";
    }
}
