using ElderlyCareSystem.Data;
using ElderlyCareSystem.Models;
using MongoDB.Driver;
using MongoDB.Bson;

namespace ElderlyCareSystem.Repositories;

public interface IElderlyRepository
{
    Task<List<ElderlyProfile>> GetAllAsync(string? facilityId = null);
    Task<ElderlyProfile?> GetByIdAsync(string id);
    Task<ElderlyProfile> CreateAsync(ElderlyProfile profile);
    Task UpdateAsync(string id, ElderlyProfile profile);
    Task DeleteAsync(string id);
    Task<List<ElderlyProfile>> SearchAsync(string keyword, string? facilityId = null);
    Task<ElderlyProfile?> GetByIdCardAsync(string idCardNumber);
    Task<ElderlyProfile?> GetByBedIdAsync(string bedId);
    Task<long> CountAsync(string? facilityId = null, string? status = null);
}

public class ElderlyRepository : IElderlyRepository
{
    private readonly MongoDbContext _context;

    public ElderlyRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<List<ElderlyProfile>> GetAllAsync(string? facilityId = null)
    {
        var filter = Builders<ElderlyProfile>.Filter.Empty;
        if (!string.IsNullOrEmpty(facilityId))
        {
            filter = Builders<ElderlyProfile>.Filter.Eq(x => x.FacilityId, facilityId);
        }
        return await _context.ElderlyProfiles.Find(filter).SortByDescending(x => x.CreatedAt).ToListAsync();
    }

    public async Task<ElderlyProfile?> GetByIdAsync(string id)
    {
        var filter = Builders<ElderlyProfile>.Filter.Eq(x => x.Id, id);
        return await _context.ElderlyProfiles.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<ElderlyProfile> CreateAsync(ElderlyProfile profile)
    {
        profile.Id = ObjectId.GenerateNewId().ToString();
        profile.CreatedAt = DateTime.UtcNow;
        profile.UpdatedAt = DateTime.UtcNow;
        await _context.ElderlyProfiles.InsertOneAsync(profile);
        return profile;
    }

    public async Task UpdateAsync(string id, ElderlyProfile profile)
    {
        profile.UpdatedAt = DateTime.UtcNow;
        var filter = Builders<ElderlyProfile>.Filter.Eq(x => x.Id, id);
        await _context.ElderlyProfiles.ReplaceOneAsync(filter, profile);
    }

    public async Task DeleteAsync(string id)
    {
        var filter = Builders<ElderlyProfile>.Filter.Eq(x => x.Id, id);
        await _context.ElderlyProfiles.DeleteOneAsync(filter);
    }

    public async Task<List<ElderlyProfile>> SearchAsync(string keyword, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<ElderlyProfile>>();
        
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<ElderlyProfile>.Filter.Eq(x => x.FacilityId, facilityId));
        }

        if (!string.IsNullOrEmpty(keyword))
        {
            var searchFilter = Builders<ElderlyProfile>.Filter.Or(
                Builders<ElderlyProfile>.Filter.Regex(x => x.Name, new BsonRegularExpression(keyword, "i")),
                Builders<ElderlyProfile>.Filter.Regex(x => x.IdCardNumber, new BsonRegularExpression(keyword, "i")),
                Builders<ElderlyProfile>.Filter.Regex(x => x.Phone, new BsonRegularExpression(keyword, "i")),
                Builders<ElderlyProfile>.Filter.Regex(x => x.BedId, new BsonRegularExpression(keyword, "i"))
            );
            filters.Add(searchFilter);
        }

        var combinedFilter = filters.Count > 0 
            ? Builders<ElderlyProfile>.Filter.And(filters) 
            : Builders<ElderlyProfile>.Filter.Empty;

        return await _context.ElderlyProfiles.Find(combinedFilter).SortByDescending(x => x.CreatedAt).Limit(100).ToListAsync();
    }

    public async Task<ElderlyProfile?> GetByIdCardAsync(string idCardNumber)
    {
        var filter = Builders<ElderlyProfile>.Filter.Eq(x => x.IdCardNumber, idCardNumber);
        return await _context.ElderlyProfiles.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<ElderlyProfile?> GetByBedIdAsync(string bedId)
    {
        var filter = Builders<ElderlyProfile>.Filter.Eq(x => x.BedId, bedId);
        return await _context.ElderlyProfiles.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<long> CountAsync(string? facilityId = null, string? status = null)
    {
        var filters = new List<FilterDefinition<ElderlyProfile>>();
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<ElderlyProfile>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        if (!string.IsNullOrEmpty(status))
        {
            filters.Add(Builders<ElderlyProfile>.Filter.Eq(x => x.Status, status));
        }
        var filter = filters.Count > 0 
            ? Builders<ElderlyProfile>.Filter.And(filters) 
            : Builders<ElderlyProfile>.Filter.Empty;
        return await _context.ElderlyProfiles.CountDocumentsAsync(filter);
    }
}
