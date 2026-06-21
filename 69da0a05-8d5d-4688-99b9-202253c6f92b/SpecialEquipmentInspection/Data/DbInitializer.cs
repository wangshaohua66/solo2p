using Microsoft.EntityFrameworkCore;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(AppDbContext context)
    {
        await context.Database.EnsureCreatedAsync();

        if (await context.Users.AnyAsync())
        {
            return;
        }

        var now = DateTime.Now;

        var inspectors = new List<Inspector>
        {
            new Inspector
            {
                Name = "张检验", CertificateNo = "SEI-2018-0001",
                CertifiableTypes = "1,2,3,4", IssueDate = new DateTime(2018, 6, 1),
                ExpiryDate = new DateTime(2027, 6, 1), Phone = "13800000001",
                Status = InspectorStatus.Active, CreatedAt = now, UpdatedAt = now
            },
            new Inspector
            {
                Name = "李检测", CertificateNo = "SEI-2019-0002",
                CertifiableTypes = "5,6", IssueDate = new DateTime(2019, 3, 15),
                ExpiryDate = new DateTime(2026, 8, 1), Phone = "13800000002",
                Status = InspectorStatus.Active, CreatedAt = now, UpdatedAt = now
            },
            new Inspector
            {
                Name = "王安全", CertificateNo = "SEI-2020-0003",
                CertifiableTypes = "1,2", IssueDate = new DateTime(2020, 9, 1),
                ExpiryDate = new DateTime(2026, 7, 1), Phone = "13800000003",
                Status = InspectorStatus.Active, CreatedAt = now, UpdatedAt = now
            }
        };
        await context.Inspectors.AddRangeAsync(inspectors);

        var users = new List<User>
        {
            new User
            {
                Username = "admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                Role = UserRole.Admin, RealName = "系统管理员", CreatedAt = now, UpdatedAt = now
            },
            new User
            {
                Username = "inspector", PasswordHash = BCrypt.Net.BCrypt.HashPassword("inspector123"),
                Role = UserRole.Inspector, RealName = "张检验", InspectorId = 1,
                Phone = "13800000001", CreatedAt = now, UpdatedAt = now
            },
            new User
            {
                Username = "userunit", PasswordHash = BCrypt.Net.BCrypt.HashPassword("userunit123"),
                Role = UserRole.UserUnit, RealName = "使用单位管理员", UseUnitCode = "UU-0001",
                Phone = "13900000001", CreatedAt = now, UpdatedAt = now
            }
        };
        await context.Users.AddRangeAsync(users);

        var devices = new List<Device>
        {
            new Device
            {
                DeviceCode = "DT-2026-0001", Name = "1号客梯", Type = DeviceType.Elevator,
                Manufacturer = "迅达电梯", Model = "5000-X1", ManufacturingDate = new DateTime(2020, 1, 1),
                UseUnitCode = "UU-0001", UseUnitName = "示例商贸有限公司", UseUnitContact = "周管理员",
                UseUnitPhone = "13900000001", Region = "城东区",
                TechnicalParameters = "{\"ratedSpeed\":1.75,\"ratedLoad\":1000,\"floors\":10}",
                LastInspectionDate = new DateTime(2025, 5, 10),
                NextInspectionDate = new DateTime(2026, 5, 10),
                Status = DeviceStatus.PendingInspection, CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                DeviceCode = "QZ-2026-0002", Name = "车间桥式起重机", Type = DeviceType.Crane,
                Manufacturer = "卫华起重", Model = "QD-20T", ManufacturingDate = new DateTime(2019, 6, 1),
                UseUnitCode = "UU-0001", UseUnitName = "示例商贸有限公司", UseUnitContact = "周管理员",
                UseUnitPhone = "13900000001", Region = "城南区",
                TechnicalParameters = "{\"ratedLoad\":20,\"span\":22.5}",
                LastInspectionDate = new DateTime(2025, 3, 20),
                NextInspectionDate = new DateTime(2026, 3, 20),
                Status = DeviceStatus.Normal, CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                DeviceCode = "YL-2026-0003", Name = "储气罐A", Type = DeviceType.PressureVessel,
                Manufacturer = "江苏申强", Model = "C-2.5", ManufacturingDate = new DateTime(2018, 10, 1),
                UseUnitCode = "UU-0002", UseUnitName = "示例机械制造厂", UseUnitContact = "吴主管",
                UseUnitPhone = "13900000002", Region = "城西区",
                TechnicalParameters = "{\"volume\":5,\"designPressure\":1.2}",
                LastInspectionDate = new DateTime(2025, 7, 1),
                NextInspectionDate = new DateTime(2026, 7, 1),
                Status = DeviceStatus.Normal, CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                DeviceCode = "GL-2026-0004", Name = "2号蒸汽锅炉", Type = DeviceType.Boiler,
                Manufacturer = "郑州锅炉", Model = "WNS4-1.25", ManufacturingDate = new DateTime(2017, 4, 1),
                UseUnitCode = "UU-0002", UseUnitName = "示例机械制造厂", UseUnitContact = "吴主管",
                UseUnitPhone = "13900000002", Region = "城北区",
                TechnicalParameters = "{\"ratedEvaporation\":4,\"ratedPressure\":1.25}",
                LastInspectionDate = new DateTime(2025, 8, 15),
                NextInspectionDate = new DateTime(2026, 8, 15),
                Status = DeviceStatus.Normal, CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                DeviceCode = "SD-2026-0005", Name = "云山客运索道", Type = DeviceType.PassengerRopeway,
                Manufacturer = "北京起重运输机械设计研究院", Model = "单线循环式",
                ManufacturingDate = new DateTime(2016, 12, 1),
                UseUnitCode = "UU-0003", UseUnitName = "云山旅游开发有限公司", UseUnitContact = "郑经理",
                UseUnitPhone = "13900000003", Region = "云山区",
                TechnicalParameters = "{\"lineLength\":1800,\"capacity\":1200}",
                LastInspectionDate = new DateTime(2025, 11, 1),
                NextInspectionDate = new DateTime(2026, 11, 1),
                Status = DeviceStatus.Normal, CreatedAt = now, UpdatedAt = now
            },
            new Device
            {
                DeviceCode = "YL-2026-0006", Name = "摩天轮", Type = DeviceType.LargeAmusementDevice,
                Manufacturer = "中山金马", Model = "MW-88", ManufacturingDate = new DateTime(2018, 5, 1),
                UseUnitCode = "UU-0003", UseUnitName = "云山旅游开发有限公司", UseUnitContact = "郑经理",
                UseUnitPhone = "13900000003", Region = "云山区",
                TechnicalParameters = "{\"height\":88,\"capacity\":336}",
                LastInspectionDate = new DateTime(2025, 9, 1),
                NextInspectionDate = new DateTime(2026, 9, 1),
                Status = DeviceStatus.Normal, CreatedAt = now, UpdatedAt = now
            }
        };
        await context.Devices.AddRangeAsync(devices);

        await context.SaveChangesAsync();
    }
}
