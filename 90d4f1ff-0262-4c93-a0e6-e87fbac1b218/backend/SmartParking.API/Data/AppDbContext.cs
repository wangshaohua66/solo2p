using Microsoft.EntityFrameworkCore;
using SmartParking.API.Models.Entities;

namespace SmartParking.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<ParkingLot> ParkingLots => Set<ParkingLot>();
    public DbSet<ParkingFloor> ParkingFloors => Set<ParkingFloor>();
    public DbSet<ParkingSpot> ParkingSpots => Set<ParkingSpot>();
    public DbSet<ParkingRecord> ParkingRecords => Set<ParkingRecord>();
    public DbSet<ChargingStation> ChargingStations => Set<ChargingStation>();
    public DbSet<ChargingReservation> ChargingReservations => Set<ChargingReservation>();
    public DbSet<ChargingSession> ChargingSessions => Set<ChargingSession>();
    public DbSet<BillingRule> BillingRules => Set<BillingRule>();
    public DbSet<TimeSlotRate> TimeSlotRates => Set<TimeSlotRate>();
    public DbSet<MemberDiscount> MemberDiscounts => Set<MemberDiscount>();
    public DbSet<ChargingTier> ChargingTiers => Set<ChargingTier>();
    public DbSet<PaymentOrder> PaymentOrders => Set<PaymentOrder>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Phone)
            .IsUnique();

        modelBuilder.Entity<ParkingSpot>()
            .HasIndex(s => s.Code)
            .IsUnique();

        modelBuilder.Entity<ChargingStation>()
            .HasIndex(s => s.Code)
            .IsUnique();

        modelBuilder.Entity<ParkingRecord>()
            .HasIndex(r => r.PlateNumber);

        modelBuilder.Entity<ParkingRecord>()
            .HasIndex(r => r.Status);

        modelBuilder.Entity<ChargingReservation>()
            .HasIndex(r => new { r.StationId, r.StartTime, r.EndTime });

        modelBuilder.Entity<PaymentOrder>()
            .HasIndex(o => o.OrderNo)
            .IsUnique();

        modelBuilder.Entity<PaymentOrder>()
            .HasIndex(o => o.Status);

        modelBuilder.Entity<WorkOrder>()
            .HasIndex(w => w.OrderNo)
            .IsUnique();

        modelBuilder.Entity<WorkOrder>()
            .HasIndex(w => w.Status);

        modelBuilder.Entity<BillingRule>()
            .HasMany(r => r.TimeSlots)
            .WithOne(t => t.Rule)
            .HasForeignKey(t => t.RuleId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BillingRule>()
            .HasMany(r => r.MemberDiscounts)
            .WithOne(d => d.Rule)
            .HasForeignKey(d => d.RuleId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BillingRule>()
            .HasMany(r => r.ChargingTiers)
            .WithOne(t => t.Rule)
            .HasForeignKey(t => t.RuleId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ParkingLot>()
            .HasMany(l => l.Floors)
            .WithOne(f => f.ParkingLot)
            .HasForeignKey(f => f.ParkingLotId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ParkingFloor>()
            .HasMany(f => f.Spots)
            .WithOne(s => s.Floor)
            .HasForeignKey(s => s.FloorId)
            .OnDelete(DeleteBehavior.Cascade);

        SeedInitialData(modelBuilder);
    }

    private static void SeedInitialData(ModelBuilder modelBuilder)
    {
        var adminId = "user_admin_001";
        var ownerId = "user_owner_001";
        var lotA = "lot_A_001";
        var floorB1 = "floor_B1_001";
        var station1 = "station_DC_001";
        var station2 = "station_DC_002";

        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = adminId,
                Username = "admin",
                Nickname = "超级管理员",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                Phone = "13800000001",
                Email = "admin@park.com",
                Role = Common.UserRole.SuperAdmin,
                MemberLevel = 0,
                Balance = 0,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = ownerId,
                Username = "owner",
                Nickname = "张先生",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                Phone = "13800000005",
                Email = "owner@park.com",
                Role = Common.UserRole.CarOwner,
                MemberLevel = 2,
                Balance = 280.50m,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<ParkingLot>().HasData(
            new ParkingLot
            {
                Id = lotA,
                Name = "A区地面停车场",
                Area = "A区",
                TotalSpots = 100,
                Latitude = 31.2304m,
                Longitude = 121.4737m,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<ParkingFloor>().HasData(
            new ParkingFloor
            {
                Id = floorB1,
                ParkingLotId = lotA,
                Name = "B1层",
                Level = -1,
                TotalSpots = 50,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        var spots = new List<ParkingSpot>();
        for (int i = 0; i < 20; i++)
        {
            int row = i / 10;
            int col = i % 10;
            spots.Add(new ParkingSpot
            {
                Id = $"spot_{i + 1:D3}",
                Code = $"B1-{i + 1:D3}",
                FloorId = floorB1,
                Status = i < 12 ? Common.ParkingSpotStatus.Available :
                         i < 16 ? Common.ParkingSpotStatus.Occupied :
                         i < 18 ? Common.ParkingSpotStatus.Reserved :
                         Common.ParkingSpotStatus.Offline,
                X = 50 + col * 70,
                Y = 50 + row * 130,
                Width = 60,
                Height = 110,
                PlateNumber = i == 12 ? "沪A12345" : i == 13 ? "沪B67890" : null,
                EntryTime = i == 12 ? DateTime.UtcNow.AddHours(-2) :
                            i == 13 ? DateTime.UtcNow.AddHours(-1) : null,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            });
        }
        modelBuilder.Entity<ParkingSpot>().HasData(spots);

        modelBuilder.Entity<ChargingStation>().HasData(
            new ChargingStation
            {
                Id = station1,
                Code = "DC-001",
                Name = "直流快充桩1号",
                Type = Common.ChargingStationType.DC,
                Power = 120,
                Status = Common.ChargingStationStatus.Idle,
                Location = "A区停车场东南角",
                ParkingLotId = lotA,
                PricePerKwh = 1.5m,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new ChargingStation
            {
                Id = station2,
                Code = "DC-002",
                Name = "直流快充桩2号",
                Type = Common.ChargingStationType.DC,
                Power = 120,
                Status = Common.ChargingStationStatus.Charging,
                CurrentPower = 85.5m,
                ChargedKwh = 42.3m,
                Location = "A区停车场东南角",
                ParkingLotId = lotA,
                PricePerKwh = 1.5m,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<BillingRule>().HasData(
            new BillingRule
            {
                Id = "rule_parking_001",
                Name = "工作日停车费率",
                Type = Common.BillingRuleType.Parking,
                Priority = 1,
                IsEnabled = true,
                DailyCap = 50m,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new BillingRule
            {
                Id = "rule_charging_001",
                Name = "阶梯充电费率",
                Type = Common.BillingRuleType.Charging,
                Priority = 1,
                IsEnabled = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
