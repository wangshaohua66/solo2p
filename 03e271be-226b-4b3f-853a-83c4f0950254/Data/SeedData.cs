using MiningGovApi.Models;

namespace MiningGovApi.Data;

public static class SeedData
{
    public static List<User> GetUsers()
    {
        return
        [
            new User
            {
                Id = 1,
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                RealName = "系统管理员",
                Role = UserRole.MiningApprover,
                Phone = "13800000001",
                Email = "admin@gov.cn",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 2,
                Username = "approver1",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass123"),
                RealName = "张审批",
                Role = UserRole.MiningApprover,
                Phone = "13800000002",
                Email = "approver1@gov.cn",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 3,
                Username = "approver2",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass123"),
                RealName = "李审批",
                Role = UserRole.MiningApprover,
                Phone = "13800000003",
                Email = "approver2@gov.cn",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 4,
                Username = "inspector1",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass123"),
                RealName = "王巡查",
                Role = UserRole.SafetyInspector,
                Phone = "13800000004",
                Email = "inspector1@gov.cn",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 5,
                Username = "inspector2",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass123"),
                RealName = "赵巡查",
                Role = UserRole.SafetyInspector,
                Phone = "13800000005",
                Email = "inspector2@gov.cn",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 6,
                Username = "trader1",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass123"),
                RealName = "刘交易",
                Role = UserRole.TradeOfficer,
                Phone = "13800000006",
                Email = "trader1@gov.cn",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 7,
                Username = "manager1",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass123"),
                RealName = "陈矿长",
                Role = UserRole.MineManager,
                Phone = "13800000007",
                Email = "manager1@mine.com",
                IsActive = true,
                MineId = 1,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 8,
                Username = "manager2",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass123"),
                RealName = "杨矿长",
                Role = UserRole.MineManager,
                Phone = "13800000008",
                Email = "manager2@mine.com",
                IsActive = true,
                MineId = 2,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        ];
    }

    public static List<Mine> GetMines()
    {
        return
        [
            new Mine
            {
                Id = 1,
                Name = "东风煤矿",
                RegistrationNo = "MK2020001",
                MineType = MineType.Coal,
                Location = "山西省大同市南郊区",
                Area = "A区",
                Reserves = 5000000,
                LegalRepresentative = "陈矿长",
                IsActive = true,
                CreatedAt = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Mine
            {
                Id = 2,
                Name = "西山铁矿",
                RegistrationNo = "MK2020002",
                MineType = MineType.Metal,
                Location = "河北省唐山市迁西县",
                Area = "B区",
                Reserves = 3000000,
                LegalRepresentative = "杨矿长",
                IsActive = true,
                CreatedAt = new DateTime(2020, 2, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Mine
            {
                Id = 3,
                Name = "南岭石灰石矿",
                RegistrationNo = "MK2020003",
                MineType = MineType.NonMetal,
                Location = "广东省清远市",
                Area = "C区",
                Reserves = 8000000,
                LegalRepresentative = "黄矿长",
                IsActive = true,
                CreatedAt = new DateTime(2020, 3, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Mine
            {
                Id = 4,
                Name = "北河砂石矿",
                RegistrationNo = "MK2020004",
                MineType = MineType.SandAndGravel,
                Location = "江苏省南京市江宁区",
                Area = "D区",
                Reserves = 2000000,
                LegalRepresentative = "周矿长",
                IsActive = true,
                CreatedAt = new DateTime(2020, 4, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        ];
    }

    public static List<MiningRight> GetMiningRights()
    {
        return
        [
            new MiningRight
            {
                Id = 1,
                LicenseNo = "CK2020001",
                MineId = 1,
                MineType = MineType.Coal,
                MiningArea = "东经112°30'-112°45',北纬40°10'-40°25'",
                ValidFrom = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                ValidTo = new DateTime(2030, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                Holder = "东风煤矿有限公司",
                Status = MiningRightStatus.Active,
                ChangeType = MiningRightChangeType.New,
                CurrentApprovalLevel = null,
                ApprovedAt = new DateTime(2020, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new MiningRight
            {
                Id = 2,
                LicenseNo = "CK2020002",
                MineId = 2,
                MineType = MineType.Metal,
                MiningArea = "东经118°20'-118°35',北纬39°50'-40°05'",
                ValidFrom = new DateTime(2020, 2, 1, 0, 0, 0, DateTimeKind.Utc),
                ValidTo = new DateTime(2028, 2, 1, 0, 0, 0, DateTimeKind.Utc),
                Holder = "西山矿业股份有限公司",
                Status = MiningRightStatus.Active,
                ChangeType = MiningRightChangeType.New,
                CurrentApprovalLevel = null,
                ApprovedAt = new DateTime(2020, 2, 20, 0, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2020, 2, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new MiningRight
            {
                Id = 3,
                LicenseNo = "CK2020003",
                MineId = 3,
                MineType = MineType.NonMetal,
                MiningArea = "东经112°50'-113°10',北纬23°30'-23°50'",
                ValidFrom = new DateTime(2020, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                ValidTo = new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                Holder = "南岭建材有限公司",
                Status = MiningRightStatus.Active,
                ChangeType = MiningRightChangeType.New,
                CurrentApprovalLevel = null,
                ApprovedAt = new DateTime(2020, 3, 25, 0, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2020, 3, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new MiningRight
            {
                Id = 4,
                LicenseNo = "CK2020004",
                MineId = 4,
                MineType = MineType.SandAndGravel,
                MiningArea = "东经118°45'-119°00',北纬31°50'-32°10'",
                ValidFrom = new DateTime(2020, 4, 1, 0, 0, 0, DateTimeKind.Utc),
                ValidTo = new DateTime(2025, 4, 1, 0, 0, 0, DateTimeKind.Utc),
                Holder = "北河砂石有限公司",
                Status = MiningRightStatus.PendingApproval,
                ChangeType = MiningRightChangeType.Renewal,
                CurrentApprovalLevel = 1,
                CreatedAt = new DateTime(2024, 12, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        ];
    }

    public static List<SensorThreshold> GetSensorThresholds()
    {
        return
        [
            new SensorThreshold
            {
                Id = 1,
                MineId = 1,
                SensorType = SensorType.GasConcentration,
                SensorCode = "GAS-001",
                WarningThreshold = 0.8m,
                CriticalThreshold = 1.2m,
                IsEnabled = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new SensorThreshold
            {
                Id = 2,
                MineId = 1,
                SensorType = SensorType.Temperature,
                SensorCode = "TEMP-001",
                WarningThreshold = 30m,
                CriticalThreshold = 35m,
                IsEnabled = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new SensorThreshold
            {
                Id = 3,
                MineId = 2,
                SensorType = SensorType.Vibration,
                SensorCode = "VIB-001",
                WarningThreshold = 5.0m,
                CriticalThreshold = 8.0m,
                IsEnabled = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new SensorThreshold
            {
                Id = 4,
                MineId = 3,
                SensorType = SensorType.AirFlow,
                SensorCode = "AIR-001",
                WarningThreshold = 2.0m,
                CriticalThreshold = 1.0m,
                IsEnabled = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        ];
    }

    public static List<MiningRightApproval> GetApprovals()
    {
        return
        [
            new MiningRightApproval
            {
                Id = 1,
                MiningRightId = 4,
                ApprovalLevel = 1,
                ApproverId = null,
                Status = ApprovalStatus.Pending,
                CreatedAt = new DateTime(2024, 12, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        ];
    }
}
