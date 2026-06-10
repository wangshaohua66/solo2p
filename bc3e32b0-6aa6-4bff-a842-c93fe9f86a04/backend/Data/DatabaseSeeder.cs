using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Data;

public static class DatabaseSeeder
{
    public static async Task SeedInitialData(AppDbContext context)
    {
        if (context.Users.Any())
            return;

        var adminId = Guid.NewGuid();
        var instructorId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        var users = new List<User>
        {
            new User
            {
                Id = adminId,
                Username = "admin",
                Email = "admin@pottery.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                Role = UserRole.Admin,
                MemberTier = MemberTier.Yearly,
                MemberExpireDate = DateTime.UtcNow.AddYears(1),
                TotalSpent = 0,
                Points = 0,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            },
            new User
            {
                Id = instructorId,
                Username = "teacher",
                Email = "teacher@pottery.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("teacher123"),
                Role = UserRole.Instructor,
                MemberTier = MemberTier.Yearly,
                MemberExpireDate = DateTime.UtcNow.AddYears(1),
                TotalSpent = 0,
                Points = 0,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            },
            new User
            {
                Id = memberId,
                Username = "member",
                Email = "member@pottery.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("member123"),
                Role = UserRole.Member,
                MemberTier = MemberTier.Quarterly,
                MemberExpireDate = DateTime.UtcNow.AddMonths(3),
                TotalSpent = 1280,
                Points = 320,
                Phone = "13800138000",
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            }
        };

        await context.Users.AddRangeAsync(users);

        var kilns = new List<Kiln>
        {
            new Kiln
            {
                Id = Guid.NewGuid(),
                Name = "电窑A",
                Type = KilnType.Electric,
                Capacity = 50,
                Status = KilnStatus.Available,
                MaxTemperature = 1280,
                Description = "常用电窑，适合素烧和釉烧"
            },
            new Kiln
            {
                Id = Guid.NewGuid(),
                Name = "汽窑B",
                Type = KilnType.Gas,
                Capacity = 80,
                Status = KilnStatus.Available,
                MaxTemperature = 1300,
                Description = "大容量汽窑，适合批量烧制"
            },
            new Kiln
            {
                Id = Guid.NewGuid(),
                Name = "柴窑",
                Type = KilnType.Wood,
                Capacity = 120,
                Status = KilnStatus.Available,
                MaxTemperature = 1350,
                Description = "传统柴窑，还原焰效果好"
            }
        };

        await context.Kilns.AddRangeAsync(kilns);

        var glazeRecipes = new List<GlazeRecipe>
        {
            new GlazeRecipe
            {
                Id = Guid.NewGuid(),
                Name = "基础透明釉",
                Code = "G-T-001",
                Version = 1,
                FiringType = FiringType.Glaze,
                TemperatureMin = 1220,
                TemperatureMax = 1260,
                Atmosphere = "氧化焰",
                Description = "经典透明釉配方，适用于各类坯体",
                CreatedById = adminId,
                CreatedByName = "admin",
                Ingredients = new List<GlazeIngredient>
                {
                    new() { Name = "长石", Percentage = 45 },
                    new() { Name = "石英", Percentage = 25 },
                    new() { Name = "高岭土", Percentage = 15 },
                    new() { Name = "石灰石", Percentage = 10 },
                    new() { Name = "锌白", Percentage = 5 }
                }
            },
            new GlazeRecipe
            {
                Id = Guid.NewGuid(),
                Name = "青瓷釉",
                Code = "G-C-001",
                Version = 1,
                FiringType = FiringType.Reduction,
                TemperatureMin = 1280,
                TemperatureMax = 1320,
                Atmosphere = "还原焰",
                Description = "传统青瓷釉，温润如玉",
                CreatedById = instructorId,
                CreatedByName = "teacher",
                Ingredients = new List<GlazeIngredient>
                {
                    new() { Name = "长石", Percentage = 40 },
                    new() { Name = "石英", Percentage = 20 },
                    new() { Name = "高岭土", Percentage = 25 },
                    new() { Name = "石灰石", Percentage = 8 },
                    new() { Name = "氧化铁", Percentage = 2 },
                    new() { Name = "滑石", Percentage = 5 }
                }
            }
        };

        await context.GlazeRecipes.AddRangeAsync(glazeRecipes);

        var stations = new List<Station>
        {
            new() { Id = Guid.NewGuid(), Name = "拉坯工位 1号", Type = StationType.Wheel, Status = StationStatus.Available, Position = 1 },
            new() { Id = Guid.NewGuid(), Name = "拉坯工位 2号", Type = StationType.Wheel, Status = StationStatus.Available, Position = 2 },
            new() { Id = Guid.NewGuid(), Name = "拉坯工位 3号", Type = StationType.Wheel, Status = StationStatus.Available, Position = 3 },
            new() { Id = Guid.NewGuid(), Name = "拉坯工位 4号", Type = StationType.Wheel, Status = StationStatus.Available, Position = 4 },
            new() { Id = Guid.NewGuid(), Name = "手捏桌 A", Type = StationType.Table, Status = StationStatus.Available, Position = 5 },
            new() { Id = Guid.NewGuid(), Name = "手捏桌 B", Type = StationType.Table, Status = StationStatus.Available, Position = 6 },
            new() { Id = Guid.NewGuid(), Name = "施釉区", Type = StationType.Glaze, Status = StationStatus.Available, Position = 7 }
        };

        await context.Stations.AddRangeAsync(stations);

        var materials = new List<Material>
        {
            new() { Id = Guid.NewGuid(), Name = "陶土 - 紫砂泥", Category = MaterialCategory.Clay, Unit = "kg", TotalQuantity = 200, ReservedQuantity = 30, AvailableQuantity = 170, MinThreshold = 50, UnitPrice = 25 },
            new() { Id = Guid.NewGuid(), Name = "陶土 - 高岭土", Category = MaterialCategory.Clay, Unit = "kg", TotalQuantity = 150, ReservedQuantity = 20, AvailableQuantity = 130, MinThreshold = 40, UnitPrice = 35 },
            new() { Id = Guid.NewGuid(), Name = "长石粉", Category = MaterialCategory.Glaze, Unit = "kg", TotalQuantity = 80, ReservedQuantity = 10, AvailableQuantity = 70, MinThreshold = 20, UnitPrice = 18 },
            new() { Id = Guid.NewGuid(), Name = "石英砂", Category = MaterialCategory.Glaze, Unit = "kg", TotalQuantity = 100, ReservedQuantity = 15, AvailableQuantity = 85, MinThreshold = 30, UnitPrice = 12 },
            new() { Id = Guid.NewGuid(), Name = "氧化铜", Category = MaterialCategory.Colorant, Unit = "kg", TotalQuantity = 5, ReservedQuantity = 1, AvailableQuantity = 4, MinThreshold = 2, UnitPrice = 120 },
            new() { Id = Guid.NewGuid(), Name = "氧化铁", Category = MaterialCategory.Colorant, Unit = "kg", TotalQuantity = 8, ReservedQuantity = 2, AvailableQuantity = 6, MinThreshold = 3, UnitPrice = 45 },
            new() { Id = Guid.NewGuid(), Name = "拉坯工具套装", Category = MaterialCategory.Tool, Unit = "套", TotalQuantity = 12, ReservedQuantity = 0, AvailableQuantity = 12, MinThreshold = 5, UnitPrice = 180 },
            new() { Id = Guid.NewGuid(), Name = "海绵", Category = MaterialCategory.Tool, Unit = "个", TotalQuantity = 30, ReservedQuantity = 5, AvailableQuantity = 25, MinThreshold = 10, UnitPrice = 8 }
        };

        await context.Materials.AddRangeAsync(materials);

        var courses = new List<Course>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Title = "零基础拉坯入门班",
                Description = "从零开始学习拉坯技艺，掌握基本手法和造型技巧",
                Type = CourseType.Wheel,
                InstructorId = instructorId,
                InstructorName = "李老师",
                Price = 299,
                Duration = 120,
                MaxStudents = 8,
                CurrentStudents = 5,
                Level = CourseLevel.Beginner,
                StartDate = DateTime.UtcNow.AddDays(7),
                EndDate = DateTime.UtcNow.AddDays(35),
                Status = CourseStatus.Published,
                Schedule = new List<CourseSession>
                {
                    new() { Date = DateTime.UtcNow.AddDays(10), StartTime = new TimeSpan(14, 0, 0), EndTime = new TimeSpan(16, 0, 0), Topic = "初识陶艺与泥料准备" },
                    new() { Date = DateTime.UtcNow.AddDays(17), StartTime = new TimeSpan(14, 0, 0), EndTime = new TimeSpan(16, 0, 0), Topic = "基础拉坯手法" },
                    new() { Date = DateTime.UtcNow.AddDays(24), StartTime = new TimeSpan(14, 0, 0), EndTime = new TimeSpan(16, 0, 0), Topic = "碗与杯的造型" },
                    new() { Date = DateTime.UtcNow.AddDays(31), StartTime = new TimeSpan(14, 0, 0), EndTime = new TimeSpan(16, 0, 0), Topic = "修坯与装饰" }
                }
            }
        };

        await context.Courses.AddRangeAsync(courses);

        var pieces = new List<PieceArchive>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Title = "青花瓷茶盏",
                Description = "一只精心制作的青花茶盏",
                MemberId = memberId,
                MemberName = "member",
                Status = PieceStatus.Completed,
                Weight = 180,
                Height = 8.5m,
                Width = 10,
                CreatedAt = DateTime.UtcNow.AddDays(-15),
                CompletedAt = DateTime.UtcNow.AddDays(-5),
                Tags = new[] { "青花瓷", "茶器", "手工拉坯" },
                Photos = new List<PiecePhoto>
                {
                    new() { Stage = PhotoStage.Clay, Url = "", ThumbnailUrl = "", Description = "泥坯状态" },
                    new() { Stage = PhotoStage.Bisque, Url = "", ThumbnailUrl = "", Description = "素烧完成" },
                    new() { Stage = PhotoStage.Glaze, Url = "", ThumbnailUrl = "", Description = "施釉完成" },
                    new() { Stage = PhotoStage.Finished, Url = "", ThumbnailUrl = "", Description = "最终成品" }
                }
            }
        };

        await context.PieceArchives.AddRangeAsync(pieces);

        var notifications = new List<Notification>
        {
            new()
            {
                Id = Guid.NewGuid(),
                UserId = memberId,
                Title = "欢迎加入陶艺工坊",
                Content = "感谢您的注册，期待与您一起探索陶艺的魅力！",
                Type = NotificationType.System,
                IsRead = false,
                CreatedAt = DateTime.UtcNow.AddDays(-30)
            }
        };

        await context.Notifications.AddRangeAsync(notifications);

        await context.SaveChangesAsync();
    }
}
