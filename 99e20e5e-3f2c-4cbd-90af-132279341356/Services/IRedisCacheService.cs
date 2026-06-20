namespace FireIoTPlatform.Services;

public interface IRedisCacheService
{
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null);
    Task<bool> ExistsAsync(string key);
    Task RemoveAsync(string key);
    Task RemoveByPatternAsync(string pattern);
    Task<long> IncrementAsync(string key, long value = 1);
    Task<long> DecrementAsync(string key, long value = 1);
    Task SetHashAsync<T>(string key, string field, T value);
    Task<T?> GetHashAsync<T>(string key, string field);
    Task<Dictionary<string, T?>> GetAllHashAsync<T>(string key);
    Task<bool> SetAddAsync<T>(string key, T value);
    Task<bool> SetRemoveAsync<T>(string key, T value);
    Task<List<T>> SetMembersAsync<T>(string key);
    Task<bool> LockTakeAsync(string key, string value, TimeSpan expiry);
    Task<bool> LockReleaseAsync(string key, string value);
    Task SetDeviceStatusAsync(long deviceId, object status, TimeSpan? expiry = null);
    Task<object?> GetDeviceStatusAsync(long deviceId);
    Task SetDeviceHeartbeatAsync(long deviceId, DateTime timestamp);
    Task<DateTime?> GetDeviceHeartbeatAsync(long deviceId);
    Task PublishAsync(string channel, string message);
}
