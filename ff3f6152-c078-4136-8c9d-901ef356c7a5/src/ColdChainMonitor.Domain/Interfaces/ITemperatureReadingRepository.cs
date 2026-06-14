using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;

namespace ColdChainMonitor.Domain.Interfaces;

public interface ITemperatureReadingRepository
{
    Task AddAsync(TemperatureReading reading);
    Task AddBatchAsync(List<TemperatureReading> readings);
    Task<List<TemperatureReading>> GetByDeviceAndTimeRangeAsync(
        string deviceId,
        DateTime startTime,
        DateTime endTime,
        int limit = 1000);
    Task<CursorPagedResult<TemperatureReading>> GetPagedByDeviceAsync(
        string deviceId,
        DateTime startTime,
        DateTime endTime,
        string? cursor,
        int limit);
    Task<TemperatureReading?> GetLatestByDeviceIdAsync(string deviceId);
    Task<List<TemperatureReading>> GetLatestByDeviceIdsAsync(List<string> deviceIds);
    Task<(double avg, double max, double min, long total, long anomaly)> GetStatsAsync(
        string deviceId,
        DateTime startTime,
        DateTime endTime);
    Task<long> CountByDeviceAndTimeRangeAsync(string deviceId, DateTime startTime, DateTime endTime);
}
