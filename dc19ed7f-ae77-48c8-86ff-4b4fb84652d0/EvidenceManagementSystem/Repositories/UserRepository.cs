using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<User?> GetByUsernameAsync(string username)
    {
        return await _dbSet.FirstOrDefaultAsync(u => u.Username == username && u.IsActive);
    }

    public async Task<User?> GetByRefreshTokenAsync(string refreshToken)
    {
        return await _dbSet.FirstOrDefaultAsync(u =>
            u.RefreshToken == refreshToken &&
            u.RefreshTokenExpiry > DateTime.UtcNow &&
            u.IsActive);
    }

    public async Task<bool> UsernameExistsAsync(string username)
    {
        return await _dbSet.AnyAsync(u => u.Username == username);
    }

    public async Task<bool> EmployeeIdExistsAsync(string employeeId)
    {
        return await _dbSet.AnyAsync(u => u.EmployeeId == employeeId);
    }
}
