using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(IServiceProvider serviceProvider)
    {
        var context = serviceProvider.GetRequiredService<AppDbContext>();
        var userRepository = serviceProvider.GetRequiredService<IUserRepository>();

        await context.Database.EnsureCreatedAsync();

        if (!await userRepository.AnyAsync(u => true))
        {
            await SeedUsersAsync(userRepository);
        }
    }

    private static async Task SeedUsersAsync(IUserRepository userRepository)
    {
        var users = new List<User>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                RealName = "系统管理员",
                EmployeeId = "ADM001",
                Department = "综合管理科",
                Phone = "13800000000",
                Email = "admin@example.com",
                Role = UserRole.EvidenceManager,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                Username = "manager",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Manager@123"),
                RealName = "物证管理员",
                EmployeeId = "WZ001",
                Department = "物证管理科",
                Phone = "13800000001",
                Email = "manager@example.com",
                Role = UserRole.EvidenceManager,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                Username = "examiner",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Examiner@123"),
                RealName = "鉴定人员",
                EmployeeId = "JD001",
                Department = "生物检验室",
                Phone = "13800000002",
                Email = "examiner@example.com",
                Role = UserRole.Examiner,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                Username = "reviewer",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Reviewer@123"),
                RealName = "审核人员",
                EmployeeId = "SH001",
                Department = "技术质量科",
                Phone = "13800000003",
                Email = "reviewer@example.com",
                Role = UserRole.Reviewer,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                Username = "leader",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Leader@123"),
                RealName = "分管领导",
                EmployeeId = "LD001",
                Department = "中心领导",
                Phone = "13800000004",
                Email = "leader@example.com",
                Role = UserRole.Leader,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        };

        foreach (var user in users)
        {
            await userRepository.AddAsync(user);
        }
    }
}
