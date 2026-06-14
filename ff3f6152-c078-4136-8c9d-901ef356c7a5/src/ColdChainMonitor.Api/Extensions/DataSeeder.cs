using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Enums;
using Serilog;

namespace ColdChainMonitor.Api.Extensions;

public static class DataSeeder
{
    public static async Task SeedDataAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var alertRuleRepository = scope.ServiceProvider.GetRequiredService<IAlertRuleRepository>();

        await SeedAdminUserAsync(userRepository);
        await SeedDefaultAlertRulesAsync(alertRuleRepository);
    }

    private static async Task SeedAdminUserAsync(IUserRepository userRepository)
    {
        var existingAdmin = await userRepository.GetByUsernameAsync("admin");
        if (existingAdmin != null)
        {
            Log.Information("Admin user already exists, skipping seed.");
            return;
        }

        var adminUser = new User
        {
            Username = "admin",
            PasswordHash = HashPassword("Admin@123456"),
            RealName = "系统管理员",
            Phone = "13800138000",
            Email = "admin@coldchain.com",
            Role = UserRole.Admin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await userRepository.AddAsync(adminUser);
        Log.Information("Default admin user created: admin / Admin@123456");

        var dispatcher = new User
        {
            Username = "dispatcher",
            PasswordHash = HashPassword("Disp@123456"),
            RealName = "调度员张三",
            Phone = "13800138001",
            Email = "dispatcher@coldchain.com",
            Role = UserRole.Dispatcher,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await userRepository.AddAsync(dispatcher);
        Log.Information("Default dispatcher user created: dispatcher / Disp@123456");

        var driver = new User
        {
            Username = "driver",
            PasswordHash = HashPassword("Driver@123456"),
            RealName = "司机李四",
            Phone = "13800138002",
            Email = "driver@coldchain.com",
            Role = UserRole.Driver,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await userRepository.AddAsync(driver);
        Log.Information("Default driver user created: driver / Driver@123456");

        var inspector = new User
        {
            Username = "inspector",
            PasswordHash = HashPassword("Insp@123456"),
            RealName = "质检员王五",
            Phone = "13800138003",
            Email = "inspector@coldchain.com",
            Role = UserRole.QualityInspector,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await userRepository.AddAsync(inspector);
        Log.Information("Default inspector user created: inspector / Insp@123456");
    }

    private static async Task SeedDefaultAlertRulesAsync(IAlertRuleRepository alertRuleRepository)
    {
        var existingRules = await alertRuleRepository.GetEnabledRulesAsync();
        if (existingRules.Count > 0)
        {
            Log.Information("Alert rules already exist, skipping seed.");
            return;
        }

        var defaultRules = new List<AlertRule>
        {
            new()
            {
                RuleName = "温度过高-普通",
                RuleCode = "TEMP_HIGH_WARNING",
                AlertType = AlertType.TemperatureHigh,
                AlertLevel = AlertLevel.Warning,
                MetricType = MetricType.Temperature,
                Operator = ComparisonOperator.GreaterThan,
                Threshold = 8.0,
                DurationSeconds = 60,
                Scope = RuleScope.Global,
                Priority = 100,
                IsEnabled = true,
                Description = "温度超过8℃持续60秒触发警告"
            },
            new()
            {
                RuleName = "温度过高-严重",
                RuleCode = "TEMP_HIGH_CRITICAL",
                AlertType = AlertType.TemperatureHigh,
                AlertLevel = AlertLevel.Critical,
                MetricType = MetricType.Temperature,
                Operator = ComparisonOperator.GreaterThan,
                Threshold = 10.0,
                DurationSeconds = 30,
                Scope = RuleScope.Global,
                Priority = 90,
                IsEnabled = true,
                Description = "温度超过10℃持续30秒触发严重警报"
            },
            new()
            {
                RuleName = "温度过低-普通",
                RuleCode = "TEMP_LOW_WARNING",
                AlertType = AlertType.TemperatureLow,
                AlertLevel = AlertLevel.Warning,
                MetricType = MetricType.Temperature,
                Operator = ComparisonOperator.LessThan,
                Threshold = 2.0,
                DurationSeconds = 60,
                Scope = RuleScope.Global,
                Priority = 100,
                IsEnabled = true,
                Description = "温度低于2℃持续60秒触发警告"
            },
            new()
            {
                RuleName = "温度过低-严重",
                RuleCode = "TEMP_LOW_CRITICAL",
                AlertType = AlertType.TemperatureLow,
                AlertLevel = AlertLevel.Critical,
                MetricType = MetricType.Temperature,
                Operator = ComparisonOperator.LessThan,
                Threshold = 0.0,
                DurationSeconds = 30,
                Scope = RuleScope.Global,
                Priority = 90,
                IsEnabled = true,
                Description = "温度低于0℃持续30秒触发严重警报"
            },
            new()
            {
                RuleName = "设备离线",
                RuleCode = "DEVICE_OFFLINE",
                AlertType = AlertType.DeviceOffline,
                AlertLevel = AlertLevel.Warning,
                MetricType = MetricType.OnlineStatus,
                Operator = ComparisonOperator.Equal,
                Threshold = 0,
                DurationSeconds = 600,
                Scope = RuleScope.Global,
                Priority = 80,
                IsEnabled = true,
                Description = "设备离线超过10分钟触发警告"
            },
            new()
            {
                RuleName = "设备低电量",
                RuleCode = "DEVICE_LOW_BATTERY",
                AlertType = AlertType.DeviceLowBattery,
                AlertLevel = AlertLevel.Warning,
                MetricType = MetricType.Battery,
                Operator = ComparisonOperator.LessThanOrEqual,
                Threshold = 20.0,
                DurationSeconds = 0,
                Scope = RuleScope.Global,
                Priority = 70,
                IsEnabled = true,
                Description = "设备电量低于20%触发警告"
            }
        };

        foreach (var rule in defaultRules)
        {
            await alertRuleRepository.AddAsync(rule);
        }

        Log.Information("Default alert rules seeded: {Count}", defaultRules.Count);
    }

    private static string HashPassword(string password)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
        var builder = new System.Text.StringBuilder();
        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2"));
        }
        return builder.ToString();
    }
}
