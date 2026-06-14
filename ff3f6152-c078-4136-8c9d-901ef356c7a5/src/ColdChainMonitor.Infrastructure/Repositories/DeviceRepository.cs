using MongoDB.Driver;
using MongoDB.Bson;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;
using ColdChainMonitor.Infrastructure.Data;

namespace ColdChainMonitor.Infrastructure.Repositories;

public class DeviceRepository : MongoRepositoryBase<Device>, IDeviceRepository
{
    public DeviceRepository(MongoDbContext context)
        : base(context, context.Devices)
    {
    }

    public async Task<Device?> GetByDeviceIdAsync(string deviceId)
    {
        var filter = Builders<Device>.Filter.Eq(d => d.DeviceId, deviceId);
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<Device>> GetByVehicleIdAsync(string vehicleId)
    {
        var filter = Builders<Device>.Filter.Eq(d => d.VehicleId, vehicleId);
        return await _collection.Find(filter).ToListAsync();
    }

    public async Task UpdateStatusAsync(string deviceId, DeviceStatus status)
    {
        var filter = Builders<Device>.Filter.Eq(d => d.DeviceId, deviceId);
        var update = Builders<Device>.Update
            .Set(d => d.Status, status)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateOneAsync(filter, update);
    }

    public async Task UpdateLastReportAsync(string deviceId, DateTime reportTime, double? batteryLevel, GpsLocation? location)
    {
        var filter = Builders<Device>.Filter.Eq(d => d.DeviceId, deviceId);
        var updateBuilder = Builders<Device>.Update
            .Set(d => d.LastReportAt, reportTime)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        if (batteryLevel.HasValue)
        {
            updateBuilder = updateBuilder.Set(d => d.BatteryLevel, batteryLevel.Value);
        }

        if (location != null)
        {
            updateBuilder = updateBuilder.Set(d => d.LastKnownLocation, location);
        }

        await _collection.UpdateOneAsync(filter, updateBuilder);
    }

    public async Task<List<Device>> GetOnlineDevicesAsync()
    {
        var filter = Builders<Device>.Filter.Eq(d => d.Status, DeviceStatus.Active);
        return await _collection.Find(filter).ToListAsync();
    }

    public async Task<List<Device>> GetOfflineDevicesAsync(int offlineThresholdMinutes)
    {
        var cutoffTime = DateTime.UtcNow.AddMinutes(-offlineThresholdMinutes);
        var filter = Builders<Device>.Filter.And(
            Builders<Device>.Filter.Ne(d => d.Status, DeviceStatus.Inactive),
            Builders<Device>.Filter.Or(
                Builders<Device>.Filter.Lt(d => d.LastReportAt, cutoffTime),
                Builders<Device>.Filter.Exists(d => d.LastReportAt, false)
            )
        );
        return await _collection.Find(filter).ToListAsync();
    }

    public async Task<(int total, int active, int offline, int lowBattery, int inactive, int faulty)> GetStatusStatsAsync()
    {
        var total = await _collection.CountDocumentsAsync(_ => true);
        var active = await _collection.CountDocumentsAsync(d => d.Status == DeviceStatus.Active);
        var offline = await _collection.CountDocumentsAsync(d => d.Status == DeviceStatus.Offline);
        var lowBattery = await _collection.CountDocumentsAsync(d => d.Status == DeviceStatus.LowBattery);
        var inactive = await _collection.CountDocumentsAsync(d => d.Status == DeviceStatus.Inactive);
        var faulty = await _collection.CountDocumentsAsync(d => d.Status == DeviceStatus.Faulty);

        return ((int)total, (int)active, (int)offline, (int)lowBattery, (int)inactive, (int)faulty);
    }

    public async Task<CursorPagedResult<Device>> GetPagedAsync(
        DeviceStatus? status,
        string? keyword,
        string? vehicleId,
        string? deviceType,
        string? cursor,
        int limit,
        bool sortDesc = true)
    {
        var filterBuilder = Builders<Device>.Filter;
        var filters = new List<FilterDefinition<Device>>();

        if (status.HasValue)
        {
            filters.Add(filterBuilder.Eq(d => d.Status, status.Value));
        }

        if (!string.IsNullOrEmpty(keyword))
        {
            filters.Add(filterBuilder.Or(
                filterBuilder.Regex(d => d.DeviceId, new BsonRegularExpression(keyword, "i")),
                filterBuilder.Regex(d => d.DeviceName, new BsonRegularExpression(keyword, "i"))
            ));
        }

        if (!string.IsNullOrEmpty(vehicleId))
        {
            filters.Add(filterBuilder.Eq(d => d.VehicleId, vehicleId));
        }

        if (!string.IsNullOrEmpty(deviceType))
        {
            filters.Add(filterBuilder.Eq(d => d.DeviceType, deviceType));
        }

        var filter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var sort = sortDesc
            ? Builders<Device>.Sort.Descending(d => d.CreatedAt)
            : Builders<Device>.Sort.Ascending(d => d.CreatedAt);

        var find = _collection.Find(filter).Sort(sort);

        if (!string.IsNullOrEmpty(cursor))
        {
            var cursorId = ObjectId.Parse(cursor);
            find = sortDesc
                ? find.Filter(filterBuilder.Lt(d => d.Id, cursorId.ToString()))
                : find.Filter(filterBuilder.Gt(d => d.Id, cursorId.ToString()));
        }

        var items = await find.Limit(limit + 1).ToListAsync();
        var hasMore = items.Count > limit;
        var resultItems = items.Take(limit).ToList();
        string? nextCursor = hasMore && resultItems.Count > 0
            ? resultItems.Last().Id
            : null;

        var totalCount = await _collection.CountDocumentsAsync(filter);

        return new CursorPagedResult<Device>
        {
            Items = resultItems,
            NextCursor = nextCursor,
            HasMore = hasMore,
            Limit = limit,
            TotalCount = totalCount
        };
    }
}
