using Newtonsoft.Json;
using StackExchange.Redis;

namespace FireIoTPlatform.Services;

public class RedisCacheService : IRedisCacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;
    private readonly string _instanceName;
    private readonly int _defaultExpiryMinutes;
    private readonly int _heartbeatExpirySeconds;

    public RedisCacheService(IConnectionMultiplexer redis, IConfiguration configuration)
    {
        _redis = redis;
        _db = redis.GetDatabase();
        _instanceName = configuration["RedisSettings:InstanceName"] ?? "FireIoT:";
        _defaultExpiryMinutes = int.TryParse(configuration["RedisSettings:DefaultExpiryMinutes"], out var mins) ? mins : 30;
        _heartbeatExpirySeconds = int.TryParse(configuration["RedisSettings:HeartbeatExpirySeconds"], out var secs) ? secs : 35;
    }

    private string GetKey(string key) => $"{_instanceName}{key}";

    public async Task<T?> GetAsync<T>(string key)
    {
        var value = await _db.StringGetAsync(GetKey(key));
        return value.IsNullOrEmpty ? default : JsonConvert.DeserializeObject<T>(value!);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        var expiryTime = expiry ?? TimeSpan.FromMinutes(_defaultExpiryMinutes);
        var serialized = JsonConvert.SerializeObject(value);
        await _db.StringSetAsync(GetKey(key), serialized, expiryTime);
    }

    public async Task<bool> ExistsAsync(string key)
    {
        return await _db.KeyExistsAsync(GetKey(key));
    }

    public async Task RemoveAsync(string key)
    {
        await _db.KeyDeleteAsync(GetKey(key));
    }

    public async Task RemoveByPatternAsync(string pattern)
    {
        foreach (var endPoint in _redis.GetEndPoints())
        {
            var server = _redis.GetServer(endPoint);
            var keys = server.Keys(pattern: GetKey(pattern)).ToArray();
            if (keys.Any())
                await _db.KeyDeleteAsync(keys);
        }
    }

    public async Task<long> IncrementAsync(string key, long value = 1)
    {
        return await _db.StringIncrementAsync(GetKey(key), value);
    }

    public async Task<long> DecrementAsync(string key, long value = 1)
    {
        return await _db.StringDecrementAsync(GetKey(key), value);
    }

    public async Task SetHashAsync<T>(string key, string field, T value)
    {
        var serialized = JsonConvert.SerializeObject(value);
        await _db.HashSetAsync(GetKey(key), field, serialized);
    }

    public async Task<T?> GetHashAsync<T>(string key, string field)
    {
        var value = await _db.HashGetAsync(GetKey(key), field);
        return value.IsNullOrEmpty ? default : JsonConvert.DeserializeObject<T>(value!);
    }

    public async Task<Dictionary<string, T?>> GetAllHashAsync<T>(string key)
    {
        var entries = await _db.HashGetAllAsync(GetKey(key));
        var result = new Dictionary<string, T?>();
        foreach (var entry in entries)
        {
            result[entry.Name!] = entry.Value.IsNullOrEmpty ? default : JsonConvert.DeserializeObject<T>(entry.Value!);
        }
        return result;
    }

    public async Task<bool> SetAddAsync<T>(string key, T value)
    {
        var serialized = JsonConvert.SerializeObject(value);
        return await _db.SetAddAsync(GetKey(key), serialized);
    }

    public async Task<bool> SetRemoveAsync<T>(string key, T value)
    {
        var serialized = JsonConvert.SerializeObject(value);
        return await _db.SetRemoveAsync(GetKey(key), serialized);
    }

    public async Task<List<T>> SetMembersAsync<T>(string key)
    {
        var values = await _db.SetMembersAsync(GetKey(key));
        var result = new List<T>();
        foreach (var value in values)
        {
            if (!value.IsNullOrEmpty)
            {
                var item = JsonConvert.DeserializeObject<T>(value!);
                if (item != null) result.Add(item);
            }
        }
        return result;
    }

    public async Task<bool> LockTakeAsync(string key, string value, TimeSpan expiry)
    {
        return await _db.LockTakeAsync(GetKey(key), value, expiry);
    }

    public async Task<bool> LockReleaseAsync(string key, string value)
    {
        return await _db.LockReleaseAsync(GetKey(key), value);
    }

    public async Task SetDeviceStatusAsync(long deviceId, object status, TimeSpan? expiry = null)
    {
        var key = $"device:status:{deviceId}";
        await SetAsync(key, status, expiry ?? TimeSpan.FromSeconds(_heartbeatExpirySeconds));
    }

    public async Task<object?> GetDeviceStatusAsync(long deviceId)
    {
        var key = $"device:status:{deviceId}";
        return await GetAsync<object>(key);
    }

    public async Task SetDeviceHeartbeatAsync(long deviceId, DateTime timestamp)
    {
        var key = $"device:heartbeat:{deviceId}";
        await SetAsync(key, timestamp, TimeSpan.FromSeconds(_heartbeatExpirySeconds));
    }

    public async Task<DateTime?> GetDeviceHeartbeatAsync(long deviceId)
    {
        var key = $"device:heartbeat:{deviceId}";
        return await GetAsync<DateTime>(key);
    }

    public async Task PublishAsync(string channel, string message)
    {
        await _redis.GetSubscriber().PublishAsync(GetKey(channel), message);
    }
}
