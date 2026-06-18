using ElderlyCareSystem.Data;
using ElderlyCareSystem.Models;
using MongoDB.Driver;
using MongoDB.Bson;

namespace ElderlyCareSystem.Repositories;

public interface IBedRepository
{
    Task<List<Bed>> GetAllAsync(string? facilityId = null);
    Task<Bed?> GetByIdAsync(string id);
    Task<Bed> CreateAsync(Bed bed);
    Task UpdateAsync(string id, Bed bed);
    Task DeleteAsync(string id);
    Task<List<Bed>> GetByStatusAsync(string status, string? facilityId = null);
    Task<List<Bed>> GetByCareZoneAsync(string careZone, string? facilityId = null);
    Task<List<Bed>> GetByFloorAsync(string floor, string building, string? facilityId = null);
    Task<(long total, long occupied, long available, long maintenance)> GetStatsAsync(string? facilityId = null);
    Task UpdateBedStatusAsync(string bedId, string status, BedHistory? history = null);
}

public class BedRepository : IBedRepository
{
    private readonly MongoDbContext _context;

    public BedRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<List<Bed>> GetAllAsync(string? facilityId = null)
    {
        var filter = Builders<Bed>.Filter.Empty;
        if (!string.IsNullOrEmpty(facilityId))
        {
            filter = Builders<Bed>.Filter.Eq(x => x.FacilityId, facilityId);
        }
        return await _context.Beds.Find(filter).SortBy(x => x.Floor).ThenBy(x => x.RoomNumber).ThenBy(x => x.BedNumber).ToListAsync();
    }

    public async Task<Bed?> GetByIdAsync(string id)
    {
        var filter = Builders<Bed>.Filter.Eq(x => x.Id, id);
        return await _context.Beds.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<Bed> CreateAsync(Bed bed)
    {
        bed.Id = ObjectId.GenerateNewId().ToString();
        bed.CreatedAt = DateTime.UtcNow;
        bed.UpdatedAt = DateTime.UtcNow;
        await _context.Beds.InsertOneAsync(bed);
        return bed;
    }

    public async Task UpdateAsync(string id, Bed bed)
    {
        bed.UpdatedAt = DateTime.UtcNow;
        var filter = Builders<Bed>.Filter.Eq(x => x.Id, id);
        await _context.Beds.ReplaceOneAsync(filter, bed);
    }

    public async Task DeleteAsync(string id)
    {
        var filter = Builders<Bed>.Filter.Eq(x => x.Id, id);
        await _context.Beds.DeleteOneAsync(filter);
    }

    public async Task<List<Bed>> GetByStatusAsync(string status, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<Bed>>
        {
            Builders<Bed>.Filter.Eq(x => x.Status, status)
        };
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<Bed>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        var filter = Builders<Bed>.Filter.And(filters);
        return await _context.Beds.Find(filter).ToListAsync();
    }

    public async Task<List<Bed>> GetByCareZoneAsync(string careZone, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<Bed>>
        {
            Builders<Bed>.Filter.Eq(x => x.CareZone, careZone)
        };
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<Bed>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        var filter = Builders<Bed>.Filter.And(filters);
        return await _context.Beds.Find(filter).SortBy(x => x.RoomNumber).ThenBy(x => x.BedNumber).ToListAsync();
    }

    public async Task<List<Bed>> GetByFloorAsync(string floor, string building, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<Bed>>
        {
            Builders<Bed>.Filter.Eq(x => x.Floor, floor),
            Builders<Bed>.Filter.Eq(x => x.Building, building)
        };
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<Bed>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        var filter = Builders<Bed>.Filter.And(filters);
        return await _context.Beds.Find(filter).SortBy(x => x.RoomNumber).ThenBy(x => x.BedNumber).ToListAsync();
    }

    public async Task<(long total, long occupied, long available, long maintenance)> GetStatsAsync(string? facilityId = null)
    {
        var baseFilter = Builders<Bed>.Filter.Empty;
        if (!string.IsNullOrEmpty(facilityId))
        {
            baseFilter = Builders<Bed>.Filter.Eq(x => x.FacilityId, facilityId);
        }

        var total = await _context.Beds.CountDocumentsAsync(baseFilter);
        var occupied = await _context.Beds.CountDocumentsAsync(
            Builders<Bed>.Filter.And(baseFilter, Builders<Bed>.Filter.Eq(x => x.Status, "Occupied")));
        var available = await _context.Beds.CountDocumentsAsync(
            Builders<Bed>.Filter.And(baseFilter, Builders<Bed>.Filter.Eq(x => x.Status, "Available")));
        var maintenance = await _context.Beds.CountDocumentsAsync(
            Builders<Bed>.Filter.And(baseFilter, Builders<Bed>.Filter.Eq(x => x.Status, "Maintenance")));

        return (total, occupied, available, maintenance);
    }

    public async Task UpdateBedStatusAsync(string bedId, string status, BedHistory? history = null)
    {
        var filter = Builders<Bed>.Filter.Eq(x => x.Id, bedId);
        var updates = Builders<Bed>.Update
            .Set(x => x.Status, status)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);

        if (history != null)
        {
            updates = updates.Push(x => x.History, history);
        }

        await _context.Beds.UpdateOneAsync(filter, updates);
    }
}
