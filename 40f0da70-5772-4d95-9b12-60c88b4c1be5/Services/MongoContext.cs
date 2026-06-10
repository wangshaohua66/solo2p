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
        EnsureSeedData();
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
                    .Ascending(g => g.Status)
                    .Descending(g => g.CreatedAt),
                new CreateIndexOptions { Name = "gears_owner_status_created" }),
            new CreateIndexModel<Gear>(
                Builders<Gear>.IndexKeys.Ascending(g => g.Category)
                    .Descending(g => g.CreatedAt),
                new CreateIndexOptions { Name = "gears_category_created" }),
            new CreateIndexModel<Gear>(
                Builders<Gear>.IndexKeys.Descending(g => g.CreatedAt),
                new CreateIndexOptions { Name = "gears_createdat_desc" }),
            new CreateIndexModel<Gear>(
                Builders<Gear>.IndexKeys.Text(g => g.Name).Text(g => g.Description),
                new CreateIndexOptions { Name = "gears_text_search", DefaultLanguage = "none" })
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

    private void EnsureSeedData()
    {
        try
        {
            var userCount = Users.EstimatedDocumentCount();
            if (userCount > 0) return;

            var demoUser = new User
            {
                Email = "demo@camphub.com",
                Nickname = "露营老王",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("demo123456"),
                AvatarUrl = "",
                CreditScore = 100,
                CreatedAt = DateTime.UtcNow.AddDays(-365)
            };

            var friendUser = new User
            {
                Email = "friend@camphub.com",
                Nickname = "背包客小李",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("demo123456"),
                AvatarUrl = "",
                CreditScore = 78,
                CreatedAt = DateTime.UtcNow.AddDays(-200)
            };

            var thirdUser = new User
            {
                Email = "xiaoming@camphub.com",
                Nickname = "小明爱露营",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("demo123456"),
                AvatarUrl = "",
                CreditScore = 55,
                CreatedAt = DateTime.UtcNow.AddDays(-100)
            };

            Users.InsertMany(new[] { demoUser, friendUser, thirdUser });

            var sampleGears = new List<Gear>
            {
                new() { OwnerId = demoUser.Id, Name = "MSR Hubba Hubba 2人帐", Category = "帐篷",
                    Description = "经典三季双层帐，轻量化徒步首选，防水2000mm", PurchasePrice = 2899,
                    UsageCount = 15, WearLevel = 20, LastMaintenanceDate = DateTime.UtcNow.AddDays(-90),
                    LastMaintenanceUsageCount = 8, NextMaintenanceAfterUses = 20, Status = GearStatus.Available },
                new() { OwnerId = demoUser.Id, Name = "天幕 3x3m 沙色", Category = "天幕",
                    Description = "银胶涂层，防晒UPF50+，可搭多种造型", PurchasePrice = 599,
                    UsageCount = 23, WearLevel = 35, Status = GearStatus.Available },
                new() { OwnerId = demoUser.Id, Name = "黑冰B700睡袋", Category = "睡袋",
                    Description = "舒适温标-5℃，700蓬松度白鸭绒", PurchasePrice = 899,
                    UsageCount = 10, WearLevel = 15, Status = GearStatus.Available },
                new() { OwnerId = demoUser.Id, Name = "蛋槽防潮垫 R值2.8", Category = "防潮垫",
                    Description = "蓝银配色，折叠式，重量轻", PurchasePrice = 129,
                    UsageCount = 30, WearLevel = 50, Status = GearStatus.Available },
                new() { OwnerId = demoUser.Id, Name = "蛋卷桌 120cm 铝合金", Category = "桌椅",
                    Description = "轻量化铝合金桌面，承重30kg", PurchasePrice = 399,
                    UsageCount = 20, WearLevel = 25, Status = GearStatus.Available },
                new() { OwnerId = demoUser.Id, Name = "月亮椅 卡其色", Category = "桌椅",
                    Description = "600D牛津布，承重150kg，带收纳袋", PurchasePrice = 259,
                    UsageCount = 18, WearLevel = 30, Status = GearStatus.Lent,
                    CurrentBorrowerId = friendUser.Id, DueDate = DateTime.UtcNow.AddDays(3) },
                new() { OwnerId = demoUser.Id, Name = "蜘蛛炉 + 气罐套装", Category = "炉具",
                    Description = "折叠式炉头，带电子点火，230g气罐", PurchasePrice = 299,
                    UsageCount = 25, WearLevel = 40, Status = GearStatus.Repair },
                new() { OwnerId = demoUser.Id, Name = "LED露营灯 暖光", Category = "灯具",
                    Description = "三档调光，USB充电，续航12小时", PurchasePrice = 159,
                    UsageCount = 12, WearLevel = 10, Status = GearStatus.Available },
                new() { OwnerId = friendUser.Id, Name = "冷山2PLUS 3人帐", Category = "帐篷",
                    Description = "家庭式帐篷，空间大，带前庭", PurchasePrice = 1599,
                    UsageCount = 8, WearLevel = 25, Status = GearStatus.Available },
                new() { OwnerId = friendUser.Id, Name = "60L登山背包", Category = "背包",
                    Description = "重装徒步背包，带防雨罩", PurchasePrice = 799,
                    UsageCount = 5, WearLevel = 15, Status = GearStatus.Available }
            };
            Gears.InsertMany(sampleGears);

            var futureEvent = new CampEvent
            {
                CreatorId = demoUser.Id,
                Title = "周末莫干山星空露营",
                Destination = "浙江莫干山露营基地",
                GeoLocation = new decimal[] { 30.5928m, 119.9219m },
                StartTime = DateTime.UtcNow.AddDays(7),
                EndTime = DateTime.UtcNow.AddDays(9),
                MaxParticipants = 8,
                Status = EventStatus.Planning,
                Description = "本周末去莫干山看星空，烧烤+桌游+日出，家庭式营地，适合新手。",
                Participants = new List<Participant>
                {
                    new() { UserId = demoUser.Id, Role = "组织者", Confirmed = true },
                    new() { UserId = friendUser.Id, Role = "司机", Confirmed = true }
                },
                GearList = new List<EventGear>
                {
                    new() { GearId = null, Name = "帐篷", Category = "帐篷", Quantity = 3, Checked = false },
                    new() { GearId = null, Name = "天幕", Category = "天幕", Quantity = 1, Checked = false },
                    new() { GearId = null, Name = "蛋卷桌", Category = "桌椅", Quantity = 2, Checked = false }
                },
                PurchaseList = new List<PurchaseItem>
                {
                    new() { Name = "羊肉串", Category = "食物", Quantity = 50, Unit = "串", Purchased = false },
                    new() { Name = "啤酒", Category = "饮品", Quantity = 24, Unit = "罐", Purchased = false },
                    new() { Name = "一次性餐具", Category = "用品", Quantity = 20, Unit = "套", Purchased = true }
                },
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            };

            var pastEvent = new CampEvent
            {
                CreatorId = demoUser.Id,
                Title = "五一崇明岛亲子露营",
                Destination = "上海崇明东平国家森林公园",
                GeoLocation = new decimal[] { 31.6522m, 121.3897m },
                StartTime = DateTime.UtcNow.AddDays(-30),
                EndTime = DateTime.UtcNow.AddDays(-28),
                MaxParticipants = 12,
                Status = EventStatus.Finished,
                Description = "五一假期亲子露营，带孩子亲近自然。",
                Participants = new List<Participant>
                {
                    new() { UserId = demoUser.Id, Role = "组织者", Confirmed = true },
                    new() { UserId = friendUser.Id, Role = "厨师", Confirmed = true },
                    new() { UserId = thirdUser.Id, Role = "摄影", Confirmed = true }
                },
                GearList = new List<EventGear>
                {
                    new() { GearId = null, Name = "家庭帐", Category = "帐篷", Quantity = 2, Checked = true, BroughtByUserId = demoUser.Id }
                },
                CreatedAt = DateTime.UtcNow.AddDays(-45)
            };

            Events.InsertMany(new[] { futureEvent, pastEvent });

            var rating = new Rating
            {
                EventId = pastEvent.Id,
                UserId = demoUser.Id,
                TransportationScore = 3,
                SceneryScore = 4,
                FacilityScore = 4,
                SafetyScore = 5,
                Season = 5,
                DestinationTag = "崇明东平森林公园",
                Comments = "设施很完善，适合带娃，但风景一般。",
                CreatedAt = DateTime.UtcNow.AddDays(-27)
            };
            Ratings.InsertOne(rating);

            var borrowRecord = new BorrowRecord
            {
                GearId = sampleGears[5].Id,
                LenderId = demoUser.Id,
                BorrowerId = friendUser.Id,
                BorrowDate = DateTime.UtcNow.AddDays(-2),
                DueDate = DateTime.UtcNow.AddDays(3),
                Notes = "周末露营用"
            };
            BorrowRecords.InsertOne(borrowRecord);

            var photo = new Photo
            {
                EventId = pastEvent.Id,
                UploaderId = demoUser.Id,
                FileUrl = "/uploads/photos/gear/demo_photo.jpg",
                ThumbUrl = "/uploads/photos/gear/demo_photo.jpg",
                GPS_Lat = 31.6522m,
                GPS_Lng = 121.3897m,
                TakenAt = DateTime.UtcNow.AddDays(-29),
                Caption = "崇明岛的日落",
                UploadedAt = DateTime.UtcNow.AddDays(-29)
            };
            Photos.InsertOne(photo);
        }
        catch
        {
            // sandbox without mongodb
        }
    }
}
