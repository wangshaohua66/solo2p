using System.Collections.Concurrent;
using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;
using ColdChainLogistics.Data;

namespace ColdChainLogistics.Services.Implementations;

public class SensorDataService : ISensorDataService
{
    private readonly ISensorDataRepository _sensorDataRepository;
    private readonly ISensorRepository _sensorRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly IShipmentRepository _shipmentRepository;
    private readonly IAlertRuleEngineService _alertRuleEngineService;
    private readonly ITableManagementService _tableManagementService;

    private static readonly ConcurrentDictionary<long, ConcurrentQueue<SensorData>> _slidingWindows = new();
    private static readonly ConcurrentDictionary<long, SlidingWindowStatsDto> _windowStats = new();
    private static readonly int _defaultWindowSizeMinutes = 5;

    public SensorDataService(
        ISensorDataRepository sensorDataRepository,
        ISensorRepository sensorRepository,
        IVehicleRepository vehicleRepository,
        IShipmentRepository shipmentRepository,
        IAlertRuleEngineService alertRuleEngineService,
        ITableManagementService tableManagementService)
    {
        _sensorDataRepository = sensorDataRepository;
        _sensorRepository = sensorRepository;
        _vehicleRepository = vehicleRepository;
        _shipmentRepository = shipmentRepository;
        _alertRuleEngineService = alertRuleEngineService;
        _tableManagementService = tableManagementService;
    }

    public async Task<SensorDataBatchResponse> ReceiveBatchAsync(SensorDataBatchRequest request)
    {
        var response = new SensorDataBatchResponse
        {
            TotalCount = request.Data.Count
        };

        var failedItems = new List<SensorDataErrorItem>();
        var validDataList = new List<SensorData>();
        var alertCount = 0;

        var vehicle = await _vehicleRepository.GetByVehicleNumberAsync(request.VehicleNumber);
        if (vehicle == null)
        {
            failedItems.AddRange(request.Data.Select(d => new SensorDataErrorItem
            {
                DeviceId = d.DeviceId,
                ErrorCode = "VEHICLE_NOT_FOUND",
                ErrorMessage = $"车辆编号 {request.VehicleNumber} 不存在"
            }));
            response.FailedItems = failedItems;
            response.FailedCount = failedItems.Count;
            return response;
        }

        var activeShipment = await _shipmentRepository.GetCurrentShipmentByVehicleIdAsync(vehicle.Id);

        foreach (var item in request.Data)
        {
            var sensor = await _sensorRepository.GetByDeviceIdAsync(item.DeviceId);
            if (sensor == null)
            {
                failedItems.Add(new SensorDataErrorItem
                {
                    DeviceId = item.DeviceId,
                    ErrorCode = "DEVICE_NOT_FOUND",
                    ErrorMessage = $"设备 {item.DeviceId} 未注册"
                });
                continue;
            }

            if (sensor.Status == SensorStatus.Decommissioned)
            {
                failedItems.Add(new SensorDataErrorItem
                {
                    DeviceId = item.DeviceId,
                    ErrorCode = "DEVICE_DECOMMISSIONED",
                    ErrorMessage = $"设备 {item.DeviceId} 已退役"
                });
                continue;
            }

            var validationErrors = new List<string>();
            var quality = DataQuality.Normal;

            if (item.Timestamp > DateTime.UtcNow.AddMinutes(5))
            {
                validationErrors.Add("时间戳超过当前时间5分钟");
                quality = DataQuality.Suspicious;
            }

            if (item.Temperature < sensor.TemperatureMin || item.Temperature > sensor.TemperatureMax)
            {
                validationErrors.Add($"温度值超出设备量程 ({sensor.TemperatureMin}°C ~ {sensor.TemperatureMax}°C)");
                quality = DataQuality.Suspicious;
            }

            if (item.Humidity < sensor.HumidityMin || item.Humidity > sensor.HumidityMax)
            {
                validationErrors.Add($"湿度值超出设备量程 ({sensor.HumidityMin}% ~ {sensor.HumidityMax}%)");
                quality = DataQuality.Suspicious;
            }

            var sensorData = new SensorData
            {
                SensorId = sensor.Id,
                VehicleId = vehicle.Id,
                ShipmentId = activeShipment?.Id,
                Timestamp = item.Timestamp,
                Temperature = item.Temperature,
                Humidity = item.Humidity,
                Quality = quality,
                ValidationErrors = validationErrors.Count > 0 ? string.Join("; ", validationErrors) : null,
                Latitude = item.Latitude,
                Longitude = item.Longitude,
                RawPayload = item.RawPayload
            };

            validDataList.Add(sensorData);

            UpdateSlidingWindow(sensor.Id, sensorData);

            var stats = CalculateWindowStats(sensor.Id);
            if (stats != null)
            {
                _windowStats.AddOrUpdate(sensor.Id, stats, (_, _) => stats);
            }

            if (quality == DataQuality.Normal)
            {
                var alerts = await _alertRuleEngineService.EvaluateRulesAsync(sensor.Id, sensorData, stats!);
                alertCount += alerts.Count;
            }

            await _sensorRepository.UpdateLastReportTimeAsync(sensor.Id, item.Timestamp, item.Temperature, item.Humidity);
        }

        if (validDataList.Count > 0)
        {
            try
            {
                await _sensorDataRepository.BulkInsertAsync(validDataList);
                response.SuccessCount = validDataList.Count;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "批量写入传感器数据失败");
                response.SuccessCount = 0;
                failedItems.AddRange(validDataList.Select(d => new SensorDataErrorItem
                {
                    DeviceId = d.SensorId.ToString(),
                    ErrorCode = "DB_WRITE_FAILED",
                    ErrorMessage = "数据库写入失败"
                }));
            }
        }

        response.FailedCount = failedItems.Count;
        response.FailedItems = failedItems.Count > 0 ? failedItems : null;
        response.AlertCount = alertCount;

        return response;
    }

    private void UpdateSlidingWindow(long sensorId, SensorData newData)
    {
        var window = _slidingWindows.GetOrAdd(sensorId, _ => new ConcurrentQueue<SensorData>());
        window.Enqueue(newData);

        var cutoff = DateTime.UtcNow.AddMinutes(-_defaultWindowSizeMinutes);
        while (window.TryPeek(out var oldest) && oldest.Timestamp < cutoff)
        {
            window.TryDequeue(out _);
        }
    }

    private SlidingWindowStatsDto? CalculateWindowStats(long sensorId)
    {
        if (!_slidingWindows.TryGetValue(sensorId, out var window) || window.IsEmpty)
            return null;

        var dataPoints = window.ToList();
        if (dataPoints.Count < 2)
            return null;

        var temperatures = dataPoints.Select(d => d.Temperature).ToList();
        var humidities = dataPoints.Select(d => d.Humidity).ToList();

        var stats = new SlidingWindowStatsDto
        {
            SensorId = sensorId,
            WindowStart = dataPoints.Min(d => d.Timestamp),
            WindowEnd = dataPoints.Max(d => d.Timestamp),
            DataPointCount = dataPoints.Count,
            MinTemperature = temperatures.Min(),
            MaxTemperature = temperatures.Max(),
            AvgTemperature = temperatures.Average(),
            MinHumidity = humidities.Min(),
            MaxHumidity = humidities.Max(),
            AvgHumidity = humidities.Average(),
            TemperatureVariance = CalculateVariance(temperatures),
            HumidityVariance = CalculateVariance(humidities),
            TemperatureVolatility = CalculateVolatility(temperatures),
            HumidityVolatility = CalculateVolatility(humidities)
        };

        return stats;
    }

    private double CalculateVariance(List<double> values)
    {
        if (values.Count < 2) return 0;
        var avg = values.Average();
        return values.Sum(v => Math.Pow(v - avg, 2)) / values.Count;
    }

    private double CalculateVolatility(List<double> values)
    {
        if (values.Count < 2) return 0;
        var changes = new List<double>();
        for (int i = 1; i < values.Count; i++)
        {
            changes.Add(Math.Abs(values[i] - values[i - 1]));
        }
        return changes.Average();
    }

    public Task<SlidingWindowStatsDto?> GetSlidingWindowStatsAsync(long sensorId, int windowMinutes = 5)
    {
        if (_windowStats.TryGetValue(sensorId, out var stats))
        {
            return Task.FromResult<SlidingWindowStatsDto?>(stats);
        }
        return Task.FromResult<SlidingWindowStatsDto?>(null);
    }

    public async Task<PagedResult<SensorDataDto>> GetPagedAsync(SensorDataQueryRequest request)
    {
        var startTime = request.StartTime ?? DateTime.UtcNow.AddHours(-1);
        var endTime = request.EndTime ?? DateTime.UtcNow;

        var data = new List<SensorData>();
        var totalCount = 0;

        if (request.SensorId.HasValue)
        {
            data = await _sensorDataRepository.GetBySensorIdAsync(request.SensorId.Value, startTime, endTime);
            totalCount = await _sensorDataRepository.GetCountBySensorIdAsync(request.SensorId.Value, startTime, endTime);
        }
        else if (request.VehicleId.HasValue)
        {
            data = await _sensorDataRepository.GetByVehicleIdAsync(request.VehicleId.Value, startTime, endTime);
            totalCount = data.Count;
        }
        else if (request.ShipmentId.HasValue)
        {
            data = await _sensorDataRepository.GetByShipmentIdAsync(request.ShipmentId.Value, startTime, endTime);
            totalCount = data.Count;
        }

        if (request.Quality.HasValue)
        {
            data = data.Where(d => (int)d.Quality == request.Quality.Value).ToList();
            totalCount = data.Count;
        }

        var pagedData = data
            .Skip((request.PageIndex - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        var dtoList = pagedData.Select(d => new SensorDataDto
        {
            Id = d.Id,
            SensorId = d.SensorId,
            SensorCode = string.Empty,
            VehicleId = d.VehicleId,
            ShipmentId = d.ShipmentId,
            Timestamp = d.Timestamp,
            Temperature = d.Temperature,
            Humidity = d.Humidity,
            Quality = (int)d.Quality,
            Latitude = d.Latitude,
            Longitude = d.Longitude
        }).ToList();

        return new PagedResult<SensorDataDto>
        {
            PageIndex = request.PageIndex,
            PageSize = request.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling((double)totalCount / request.PageSize),
            Items = dtoList
        };
    }

    public async Task<List<SensorDataDto>> GetByShipmentIdAsync(long shipmentId, DateTime startTime, DateTime endTime)
    {
        var data = await _sensorDataRepository.GetByShipmentIdAsync(shipmentId, startTime, endTime);
        return data.Select(d => new SensorDataDto
        {
            Id = d.Id,
            SensorId = d.SensorId,
            Timestamp = d.Timestamp,
            Temperature = d.Temperature,
            Humidity = d.Humidity,
            Quality = (int)d.Quality,
            Latitude = d.Latitude,
            Longitude = d.Longitude
        }).ToList();
    }
}
