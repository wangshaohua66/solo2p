using Microsoft.Extensions.Caching.Distributed;
using Newtonsoft.Json;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class RedisCacheService : IRedisCacheService
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<RedisCacheService> _logger;
    private readonly IConfiguration _config;

    public RedisCacheService(IDistributedCache cache, ILogger<RedisCacheService> logger, IConfiguration config)
    {
        _cache = cache;
        _logger = logger;
        _config = config;
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            var data = await _cache.GetStringAsync(key);
            if (string.IsNullOrEmpty(data)) return default;
            return JsonConvert.DeserializeObject<T>(data);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "读取 Redis 缓存失败 key={Key}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        try
        {
            var data = JsonConvert.SerializeObject(value);
            var options = expiry.HasValue
                ? new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = expiry.Value }
                : new DistributedCacheEntryOptions { SlidingExpiration = TimeSpan.FromMinutes(30) };
            await _cache.SetStringAsync(key, data, options);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "写入 Redis 缓存失败 key={Key}", key);
        }
    }

    public async Task RemoveAsync(string key)
    {
        try
        {
            await _cache.RemoveAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "删除 Redis 缓存失败 key={Key}", key);
        }
    }

    public async Task<bool> ExistsAsync(string key)
    {
        try
        {
            return !string.IsNullOrEmpty(await _cache.GetStringAsync(key));
        }
        catch
        {
            return false;
        }
    }

    public async Task RefreshParkingSpotAsync(string spotId, ParkingSpotDto spot)
    {
        var ttl = int.Parse(_config["RedisCache:ParkingSpotTTL"] ?? "60");
        await SetAsync($"spot:{spotId}", spot, TimeSpan.FromSeconds(ttl));
    }

    public async Task<ParkingSpotDto?> GetParkingSpotAsync(string spotId)
    {
        return await GetAsync<ParkingSpotDto>($"spot:{spotId}");
    }

    public async Task RefreshChargingStationAsync(string stationId, ChargingStationDto station)
    {
        var ttl = int.Parse(_config["RedisCache:ChargingStationTTL"] ?? "60");
        await SetAsync($"station:{stationId}", station, TimeSpan.FromSeconds(ttl));
    }

    public async Task<ChargingStationDto?> GetChargingStationAsync(string stationId)
    {
        return await GetAsync<ChargingStationDto>($"station:{stationId}");
    }
}
