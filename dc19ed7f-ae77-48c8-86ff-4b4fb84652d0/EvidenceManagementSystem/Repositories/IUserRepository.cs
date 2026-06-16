using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Repositories;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByUsernameAsync(string username);
    Task<User?> GetByRefreshTokenAsync(string refreshToken);
    Task<bool> UsernameExistsAsync(string username);
    Task<bool> EmployeeIdExistsAsync(string employeeId);
    Task<List<User>> GetByRoleAsync(UserRole role);
}
