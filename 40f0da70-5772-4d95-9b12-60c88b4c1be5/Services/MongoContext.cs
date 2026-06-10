using Microsoft.Extensions.Options;
using MongoDB.Driver;
using CampHub.Models;

namespace CampHub.Services;

public class MongoContext
{
    public readonly IMongoDatabase Database;
    public readonly MongoDbSettings Settings;

    public MongoContext(IOptions<MongoDbSettings> settings)
    {
        Settings = settings.Value;
        var client = new MongoClient(Settings.ConnectionString);
        Database = client.GetDatabase(Settings.DatabaseName);
        EnsureIndexes();
    }

    public IMongoCollection<User> Users =>
        Database.GetCollection<User>("users");

    public IMongoCollection<RefreshToken> RefreshTokens =>
        Database.GetCollection<RefreshToken>("refresh_tokens");

    public IMongoCollection<CreditLog> CreditLogs =>
        Database.GetCollection<CreditLog>("credit_logs");

    public IMongoCollection<Gear> Gears =>
        Database.GetCollection<Gear>("gears");

    public IMongoCollection<BorrowRecord> BorrowRecords =>
        Database.GetCollection<BorrowRecord>("borrow_records");

    public IMongoCollection<CampEvent> Events =>
        Database.GetCollection<CampEvent>("events");

    public IMongoCollection<Rating> Ratings =>
        Database.GetCollection<Rating>("ratings");

    public IMongoCollection<Photo> Photos =>
        Database.GetCollection<Photo>("photos");

    private void EnsureIndexes()
    {
        CreateIndexesForCollection("users", new[]
        {
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(u => u.Email),
                new CreateIndexOptions { Unique = true, Name = "users_email_unique" })
        });

        CreateIndexesForCollection("refresh_tokens", new[]
        {
            new CreateIndexModel<RefreshToken>(
                Builders<RefreshToken>.IndexKeys.Ascending(r => r.UserId)
                    .Ascending(r => r.ExpiresAt).Ascending(r => r.Revoked),
                new CreateIndexOptions { Name = "rt_user_expire_revoked" })
        });

        CreateIndexesForCollection("credit_logs", new[]
        {
            new CreateIndexModel<CreditLog>(
                Builders<CreditLog>.IndexKeys.Ascending(c => c.UserId)
                    .Descending(c => c.CreatedAt),
                new CreateIndexOptions { Name = "creditlogs_user_createdat" })
        });

        CreateIndexesForCollection("gears", new[]
        {
            new CreateIndexModel<Gear>(
                Builders<Gear>.IndexKeys.Ascending(g => g.OwnerId)
                    .Ascending(g => g.Status),
                new CreateIndexOptions { Name = "gears_owner_status" }),
            new CreateIndexModel<Gear>(
                Builders<Gear>.IndexKeys.Ascending(g => g.Category),
                new CreateIndexOptions { Name = "gears_category" }),
            new CreateIndexModel<Gear>(
                Builders<Gear>.IndexKeys.Text(g => g.Name).Text(g => g.Description),
                new CreateIndexOptions { Name = "gears_text_search" })
        });

        CreateIndexesForCollection("borrow_records", new[]
        {
            new CreateIndexModel<BorrowRecord>(
                Builders<BorrowRecord>.IndexKeys.Ascending(b => b.GearId)
                    .Ascending(b => b.ActualReturnDate),
                new CreateIndexOptions { Name = "br_gear_return" }),
            new CreateIndexModel<BorrowRecord>(
                Builders<BorrowRecord>.IndexKeys.Ascending(b => b.BorrowerId)
                    .Ascending(b => b.DueDate),
                new CreateIndexOptions { Name = "br_borrower_duedate" })
        });

        CreateIndexesForCollection("events", new[]
        {
            new CreateIndexModel<CampEvent>(
                Builders<CampEvent>.IndexKeys.Ascending(e => e.CreatorId)
                    .Ascending(e => e.StartTime),
                new CreateIndexOptions { Name = "events_creator_starttime" }),
            new CreateIndexModel<CampEvent>(
                Builders<CampEvent>.IndexKeys.Ascending(e => e.Status)
                    .Ascending(e => e.StartTime),
                new CreateIndexOptions { Name = "events_status_starttime" }),
            new CreateIndexModel<CampEvent>(
                Builders<CampEvent>.IndexKeys.Ascending("participants.userId"),
                new CreateIndexOptions { Name = "events_participants_userid" })
        });

        CreateIndexesForCollection("ratings", new[]
        {
            new CreateIndexModel<Rating>(
                Builders<Rating>.IndexKeys.Ascending(r => r.EventId)
                    .Ascending(r => r.UserId),
                new CreateIndexOptions { Unique = true, Name = "ratings_event_user_unique" }),
            new CreateIndexModel<Rating>(
                Builders<Rating>.IndexKeys.Ascending(r => r.DestinationTag)
                    .Ascending(r => r.Season),
                new CreateIndexOptions { Name = "ratings_tag_season" })
        });

        CreateIndexesForCollection("photos", new[]
        {
            new CreateIndexModel<Photo>(
                Builders<Photo>.IndexKeys.Ascending(p => p.EventId)
                    .Ascending(p => p.TakenAt),
                new CreateIndexOptions { Name = "photos_event_takenat" }),
            new CreateIndexModel<Photo>(
                Builders<Photo>.IndexKeys.Ascending(p => p.UploaderId),
                new CreateIndexOptions { Name = "photos_uploader" })
        });
    }

    private void CreateIndexesForCollection<TDoc>(
        string collectionName,
        IEnumerable<CreateIndexModel<TDoc>> indexes)
    {
        try
        {
            var col = Database.GetCollection<TDoc>(collectionName);
            col.Indexes.CreateMany(indexes);
        }
        catch (MongoCommandException ex) when (ex.Code == 85 || ex.Code == 86 || ex.Message.Contains("already exists"))
        {
            // ignore duplicate index errors
        }
        catch
        {
            // for sandbox without mongodb running
        }
    }
}
