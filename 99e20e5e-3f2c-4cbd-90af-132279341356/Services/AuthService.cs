using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Auth;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;

namespace FireIoTPlatform.Services;

public class AuthService : IAuthService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(IUnitOfWork unitOfWork, IConfiguration config, ILogger<AuthService> logger)
    {
        _unitOfWork = unitOfWork;
        _config = config;
        _logger = logger;
    }

    public async Task<ApiResponse<LoginResultDto>> LoginAsync(LoginDto dto)
    {
        var user = await _unitOfWork.Users.FirstOrDefaultAsync(u => u.UserName == dto.UserName && !u.IsDeleted);
        if (user == null) return ApiResponse<LoginResultDto>.Error(404, "用户名或密码错误");
        if (!user.IsActive) return ApiResponse<LoginResultDto>.Error(400, "账号已被禁用");

        var (hash, salt) = HashPassword(dto.Password, user.PasswordSalt);
        if (hash != user.PasswordHash) return ApiResponse<LoginResultDto>.Error(400, "用户名或密码错误");

        user.LastLoginAt = DateTime.Now;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync();

        var token = GenerateJwtToken(user);
        var result = new LoginResultDto
        {
            Token = token,
            ExpiresAt = DateTime.Now.AddHours(double.TryParse(_config["JwtSettings:ExpiryHours"], out var h) ? h : 24),
            User = await MapToUserDtoAsync(user)
        };

        _logger.LogInformation($"用户登录成功: UserName={dto.UserName}");
        return ApiResponse<LoginResultDto>.Success("登录成功", result);
    }

    public async Task<ApiResponse<UserDto>> GetUserByIdAsync(long id)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id);
        if (user == null || user.IsDeleted) return ApiResponse<UserDto>.Error(404, "用户不存在");
        return ApiResponse<UserDto>.Success(await MapToUserDtoAsync(user));
    }

    public async Task<ApiResponse<PagedResult<UserDto>>> GetUsersPagedAsync(UserQueryDto query)
    {
        var predicate = PredicateBuilder.True<User>().And(u => !u.IsDeleted);
        if (query.Role.HasValue) predicate = predicate.And(u => u.Role == query.Role.Value);
        if (query.FireStationId.HasValue) predicate = predicate.And(u => u.FireStationId == query.FireStationId.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(u => u.FireUnitId == query.FireUnitId.Value);
        if (!string.IsNullOrEmpty(query.DistrictCode)) predicate = predicate.And(u => u.DistrictCode == query.DistrictCode);
        if (query.IsActive.HasValue) predicate = predicate.And(u => u.IsActive == query.IsActive.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(u => u.UserName.Contains(query.Keyword) || u.RealName.Contains(query.Keyword));

        var result = await _unitOfWork.Users.GetPagedAsync(predicate, query.PageIndex, query.PageSize, u => u.CreatedAt, query.IsDescending);
        var dtos = new List<UserDto>();
        foreach (var u in result.Items) dtos.Add(await MapToUserDtoAsync(u));

        return ApiResponse<PagedResult<UserDto>>.Success(new PagedResult<UserDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<UserDto>> CreateUserAsync(UserCreateDto dto)
    {
        if (await _unitOfWork.Users.ExistsAsync(u => u.UserName == dto.UserName && !u.IsDeleted))
            return ApiResponse<UserDto>.Error(400, "用户名已存在");

        var (hash, salt) = HashPassword(dto.Password);
        var user = new User
        {
            UserName = dto.UserName,
            PasswordHash = hash,
            PasswordSalt = salt,
            RealName = dto.RealName,
            Phone = dto.Phone,
            Email = dto.Email,
            Role = dto.Role,
            FireStationId = dto.FireStationId,
            FireUnitId = dto.FireUnitId,
            DistrictCode = dto.DistrictCode,
            Description = dto.Description,
            IsActive = true
        };

        await _unitOfWork.Users.AddAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return ApiResponse<UserDto>.Success("创建成功", await MapToUserDtoAsync(user));
    }

    public async Task<ApiResponse<bool>> UpdateUserAsync(long id, UserUpdateDto dto)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id);
        if (user == null || user.IsDeleted) return ApiResponse<bool>.Error(404, "用户不存在");

        if (!string.IsNullOrEmpty(dto.RealName)) user.RealName = dto.RealName;
        if (!string.IsNullOrEmpty(dto.Phone)) user.Phone = dto.Phone;
        if (!string.IsNullOrEmpty(dto.Email)) user.Email = dto.Email;
        if (dto.Role.HasValue) user.Role = dto.Role.Value;
        if (dto.FireStationId.HasValue) user.FireStationId = dto.FireStationId.Value;
        if (dto.FireUnitId.HasValue) user.FireUnitId = dto.FireUnitId.Value;
        if (!string.IsNullOrEmpty(dto.DistrictCode)) user.DistrictCode = dto.DistrictCode;
        if (dto.IsActive.HasValue) user.IsActive = dto.IsActive.Value;
        if (!string.IsNullOrEmpty(dto.Description)) user.Description = dto.Description;

        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<bool>> DeleteUserAsync(long id)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(id);
        if (user == null || user.IsDeleted) return ApiResponse<bool>.Error(404, "用户不存在");
        user.IsDeleted = true;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("删除成功", true);
    }

    public async Task<ApiResponse<bool>> ChangePasswordAsync(ChangePasswordDto dto)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(dto.UserId);
        if (user == null || user.IsDeleted) return ApiResponse<bool>.Error(404, "用户不存在");

        var (oldHash, _) = HashPassword(dto.OldPassword, user.PasswordSalt);
        if (oldHash != user.PasswordHash) return ApiResponse<bool>.Error(400, "原密码错误");

        var (newHash, newSalt) = HashPassword(dto.NewPassword);
        user.PasswordHash = newHash;
        user.PasswordSalt = newSalt;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("密码修改成功", true);
    }

    public async Task<ApiResponse<bool>> ResetPasswordAsync(long userId, string newPassword)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        if (user == null || user.IsDeleted) return ApiResponse<bool>.Error(404, "用户不存在");

        var (hash, salt) = HashPassword(newPassword);
        user.PasswordHash = hash;
        user.PasswordSalt = salt;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("密码重置成功", true);
    }

    private async Task<UserDto> MapToUserDtoAsync(User user)
    {
        var station = user.FireStationId.HasValue ? await _unitOfWork.FireStations.GetByIdAsync(user.FireStationId.Value) : null;
        var unit = user.FireUnitId.HasValue ? await _unitOfWork.FireUnits.GetByIdAsync(user.FireUnitId.Value) : null;
        return new UserDto
        {
            Id = user.Id,
            UserName = user.UserName,
            RealName = user.RealName,
            Phone = user.Phone,
            Email = user.Email,
            Role = user.Role,
            RoleName = GetRoleName(user.Role),
            FireStationId = user.FireStationId,
            FireStationName = station?.StationName,
            FireUnitId = user.FireUnitId,
            FireUnitName = unit?.Name,
            AvatarUrl = user.AvatarUrl,
            DistrictCode = user.DistrictCode,
            IsActive = user.IsActive
        };
    }

    private string GenerateJwtToken(User user)
    {
        var secretKey = _config["JwtSettings:SecretKey"] ?? "FireIoTPlatform2024SuperSecretKeyForJwtTokenAuthentication";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("RealName", user.RealName)
        };

        var token = new JwtSecurityToken(
            issuer: _config["JwtSettings:Issuer"],
            audience: _config["JwtSettings:Audience"],
            claims: claims,
            expires: DateTime.Now.AddHours(double.TryParse(_config["JwtSettings:ExpiryHours"], out var h) ? h : 24),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static (string Hash, string Salt) HashPassword(string password, string? existingSalt = null)
    {
        var salt = existingSalt ?? Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        using var pbkdf2 = new Rfc2898DeriveBytes(password, Convert.FromBase64String(salt), 10000, HashAlgorithmName.SHA256);
        var hash = Convert.ToBase64String(pbkdf2.GetBytes(32));
        return (hash, salt);
    }

    private static string GetRoleName(UserRole r) => r switch
    {
        UserRole.Administrator => "系统管理员",
        UserRole.Supervisor => "消防监督员",
        UserRole.Inspector => "巡检人员",
        UserRole.Firefighter => "消防员",
        UserRole.Maintenance => "维保人员",
        UserRole.UnitAdmin => "单位管理员",
        _ => "未知"
    };
}
