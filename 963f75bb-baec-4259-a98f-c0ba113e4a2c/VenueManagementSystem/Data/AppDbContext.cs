using Microsoft.EntityFrameworkCore;
using VenueManagementSystem.Models;

namespace VenueManagementSystem.Data;

/// <summary>
/// 场馆管理系统数据上下文
/// 提供对所有实体的数据库访问，配置种子数据
/// </summary>
public class AppDbContext : DbContext
{
    /// <summary>
    /// 初始化数据上下文
    /// </summary>
    /// <param name="options">数据库上下文选项</param>
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    /// <summary>
    /// 场馆数据集
    /// </summary>
    public DbSet<Venue> Venues { get; set; }

    /// <summary>
    /// 资源数据集
    /// </summary>
    public DbSet<Resource> Resources { get; set; }

    /// <summary>
    /// 活动数据集
    /// </summary>
    public DbSet<EventItem> Events { get; set; }

    /// <summary>
    /// 用户数据集
    /// </summary>
    public DbSet<User> Users { get; set; }

    /// <summary>
    /// 设备数据集
    /// </summary>
    public DbSet<Equipment> Equipments { get; set; }

    /// <summary>
    /// 排期时段数据集
    /// </summary>
    public DbSet<ScheduleSlot> ScheduleSlots { get; set; }

    /// <summary>
    /// 审批步骤数据集
    /// </summary>
    public DbSet<ApprovalStep> ApprovalSteps { get; set; }

    /// <summary>
    /// 应急预案数据集
    /// </summary>
    public DbSet<EmergencyPlan> EmergencyPlans { get; set; }

    /// <summary>
    /// 应急日志数据集
    /// </summary>
    public DbSet<EmergencyLog> EmergencyLogs { get; set; }

    /// <summary>
    /// 通知数据集
    /// </summary>
    public DbSet<Notification> Notifications { get; set; }

    /// <summary>
    /// 票务销售数据集
    /// </summary>
    public DbSet<TicketSales> TicketSales { get; set; }

    /// <summary>
    /// 配置模型创建时的实体关系和种子数据
    /// </summary>
    /// <param name="modelBuilder">模型构建器</param>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Venue>(entity =>
        {
            entity.HasMany(v => v.Resources)
                  .WithOne(r => r.Venue)
                  .HasForeignKey(r => r.VenueId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(v => v.Events)
                  .WithOne(e => e.Venue)
                  .HasForeignKey(e => e.VenueId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(v => v.Equipments)
                  .WithOne(e => e.Venue)
                  .HasForeignKey(e => e.VenueId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(v => v.EmergencyLogs)
                  .WithOne(e => e.Venue)
                  .HasForeignKey(e => e.VenueId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Resource>(entity =>
        {
            entity.HasMany(r => r.ScheduleSlots)
                  .WithOne(s => s.Resource)
                  .HasForeignKey(s => s.ResourceId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EventItem>(entity =>
        {
            entity.HasMany(e => e.ScheduleSlots)
                  .WithOne(s => s.EventItem)
                  .HasForeignKey(s => s.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.TicketSales)
                  .WithOne(t => t.EventItem)
                  .HasForeignKey(t => t.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.ApprovalSteps)
                  .WithOne(a => a.EventItem)
                  .HasForeignKey(a => a.EventId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasMany(u => u.Notifications)
                  .WithOne(n => n.User)
                  .HasForeignKey(n => n.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(u => u.Username)
                  .IsUnique();
        });

        modelBuilder.Entity<EmergencyPlan>(entity =>
        {
            entity.HasMany(e => e.EmergencyLogs)
                  .WithOne(l => l.EmergencyPlan)
                  .HasForeignKey(l => l.PlanId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ScheduleSlot>(entity =>
        {
            entity.HasIndex(s => new { s.VenueId, s.ResourceId, s.StartTime, s.EndTime });
            entity.HasIndex(s => s.EventId);
        });

        modelBuilder.Entity<ApprovalStep>(entity =>
        {
            entity.HasIndex(a => new { a.EventId, a.AssignedTo });
        });

        SeedData(modelBuilder);
    }

    /// <summary>
    /// 配置种子数据
    /// 包含3个场馆、35类资源、测试用户
    /// </summary>
    /// <param name="modelBuilder">模型构建器</param>
    private static void SeedData(ModelBuilder modelBuilder)
    {
        var venues = new List<Venue>
        {
            new() { Id = 1, Name = "主体育场", Capacity = 60000, Location = "北京市朝阳区", Status = "Active", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new() { Id = 2, Name = "室内体育馆", Capacity = 18000, Location = "北京市海淀区", Status = "Active", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new() { Id = 3, Name = "游泳馆", Capacity = 8000, Location = "北京市丰台区", Status = "Active", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
        };
        modelBuilder.Entity<Venue>().HasData(venues);

        var resourceTypes = new[]
        {
            "主舞台", "观众席A区", "观众席B区", "观众席C区", "观众席D区",
            "VIP包厢1", "VIP包厢2", "VIP包厢3", "VIP包厢4", "VIP包厢5",
            "化妆间1", "化妆间2", "化妆间3", "休息厅", "新闻发布厅",
            "媒体中心", "运动员休息室", "裁判员休息室", "会议室A", "会议室B",
            "停车场A", "停车场B", "停车场C", "主入口", "次入口",
            "贵宾入口", "安全出口1", "安全出口2", "设备间", "配电室",
            "空调机房", "音响控制室", "灯光控制室", "大屏幕", "记分牌"
        };

        var resources = new List<Resource>();
        int resourceId = 1;
        foreach (var venue in venues)
        {
            for (int i = 0; i < resourceTypes.Length; i++)
            {
                resources.Add(new Resource
                {
                    Id = resourceId,
                    VenueId = venue.Id,
                    Name = $"{venue.Name}-{resourceTypes[i]}",
                    Type = resourceTypes[i],
                    Capacity = i < 5 ? 12000 : i < 10 ? 50 : 20,
                    Status = "Available",
                    ConversionTimeMinutes = i < 3 ? 120 : 30,
                    PositionX = (i % 7) * 10,
                    PositionY = (i / 7) * 10,
                    PositionZ = i < 15 ? 1 : 2
                });
                resourceId++;
            }
        }
        modelBuilder.Entity<Resource>().HasData(resources);

        var equipmentTypes = new[]
        {
            "音响系统", "灯光系统", "大屏幕显示系统", "空调系统", "电梯系统",
            "消防系统", "监控系统", "门禁系统", "广播系统", "网络设备"
        };

        var equipments = new List<Equipment>();
        int equipmentId = 1;
        foreach (var venue in venues)
        {
            foreach (var type in equipmentTypes)
            {
                equipments.Add(new Equipment
                {
                    Id = equipmentId,
                    VenueId = venue.Id,
                    Name = $"{venue.Name}-{type}",
                    Type = type,
                    Model = $"{type}-V1.0",
                    Status = "Normal",
                    ModeCompatibility = "Normal,Maintenance,Emergency",
                    Location = $"{venue.Name}设备间",
                    LastMaintenance = DateTime.UtcNow.AddDays(-30)
                });
                equipmentId++;
            }
        }
        modelBuilder.Entity<Equipment>().HasData(equipments);

        var users = new List<User>
        {
            new() { Id = 1, Username = "admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"), FullName = "系统管理员", Role = "Admin", Email = "admin@venue.com", Phone = "13800138000", IsActive = true },
            new() { Id = 2, Username = "venue_manager", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), FullName = "张经理", Role = "VenueManager", Email = "manager@venue.com", Phone = "13800138001", IsActive = true },
            new() { Id = 3, Username = "scheduler1", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), FullName = "李调度员", Role = "Scheduler", Email = "scheduler1@venue.com", Phone = "13800138002", IsActive = true },
            new() { Id = 4, Username = "scheduler2", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), FullName = "王调度员", Role = "Scheduler", Email = "scheduler2@venue.com", Phone = "13800138003", IsActive = true },
            new() { Id = 5, Username = "event_coordinator", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), FullName = "赵协调员", Role = "EventCoordinator", Email = "coordinator@venue.com", Phone = "13800138004", IsActive = true },
            new() { Id = 6, Username = "ticket_admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), FullName = "孙票务", Role = "TicketAdmin", Email = "ticket@venue.com", Phone = "13800138005", IsActive = true },
            new() { Id = 7, Username = "security_super", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"), FullName = "钱安保", Role = "SecuritySupervisor", Email = "security@venue.com", Phone = "13800138006", IsActive = true }
        };

        for (int i = 0; i < 20; i++)
        {
            users.Add(new User
            {
                Id = 8 + i,
                Username = $"scheduler_{i + 1}",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                FullName = $"调度员{i + 1}",
                Role = "Scheduler",
                Email = $"scheduler{i + 1}@venue.com",
                Phone = $"138001380{i + 7:D2}",
                IsActive = true
            });
        }

        for (int i = 0; i < 10; i++)
        {
            users.Add(new User
            {
                Id = 28 + i,
                Username = $"ticket_{i + 1}",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                FullName = $"票务员{i + 1}",
                Role = "TicketAdmin",
                Email = $"ticket{i + 1}@venue.com",
                Phone = $"138001381{i + 0:D2}",
                IsActive = true
            });
        }
        modelBuilder.Entity<User>().HasData(users);

        var emergencyPlans = new List<EmergencyPlan>
        {
            new()
            {
                Id = 1,
                Type = "Weather",
                Name = "暴雨应急预案",
                Description = "应对极端暴雨天气的应急处置方案",
                StepsJson = "[{\"StepId\":1,\"Name\":\"发布预警\",\"DurationMinutes\":5,\"RequiredRole\":\"SecuritySupervisor\"},{\"StepId\":2,\"Name\":\"人员疏散\",\"DurationMinutes\":30,\"RequiredRole\":\"VenueManager\"},{\"StepId\":3,\"Name\":\"设备保护\",\"DurationMinutes\":15,\"RequiredRole\":\"EventCoordinator\"},{\"StepId\":4,\"Name\":\"灾情评估\",\"DurationMinutes\":20,\"RequiredRole\":\"VenueManager\"}]"
            },
            new()
            {
                Id = 2,
                Type = "Equipment",
                Name = "电力故障应急预案",
                Description = "应对电力系统故障的应急处置方案",
                StepsJson = "[{\"StepId\":1,\"Name\":\"启动备用电源\",\"DurationMinutes\":5,\"RequiredRole\":\"EventCoordinator\"},{\"StepId\":2,\"Name\":\"人员安全引导\",\"DurationMinutes\":10,\"RequiredRole\":\"SecuritySupervisor\"},{\"StepId\":3,\"Name\":\"故障排查\",\"DurationMinutes\":30,\"RequiredRole\":\"EventCoordinator\"},{\"StepId\":4,\"Name\":\"恢复供电\",\"DurationMinutes\":15,\"RequiredRole\":\"EventCoordinator\"}]"
            },
            new()
            {
                Id = 3,
                Type = "Security",
                Name = "人群踩踏应急预案",
                Description = "应对人群聚集踩踏风险的应急处置方案",
                StepsJson = "[{\"StepId\":1,\"Name\":\"启动预警\",\"DurationMinutes\":3,\"RequiredRole\":\"SecuritySupervisor\"},{\"StepId\":2,\"Name\":\"疏散引导\",\"DurationMinutes\":15,\"RequiredRole\":\"SecuritySupervisor\"},{\"StepId\":3,\"Name\":\"医疗救援\",\"DurationMinutes\":10,\"RequiredRole\":\"VenueManager\"},{\"StepId\":4,\"Name\":\"现场控制\",\"DurationMinutes\":30,\"RequiredRole\":\"SecuritySupervisor\"}]"
            }
        };
        modelBuilder.Entity<EmergencyPlan>().HasData(emergencyPlans);
    }
}
