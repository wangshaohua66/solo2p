using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Statistics;

namespace FireIoTPlatform.Services;

public interface IStatisticsService
{
    Task<ApiResponse<DashboardOverviewDto>> GetDashboardOverviewAsync(string? districtCode = null);
    Task<ApiResponse<List<AlarmTrendDto>>> GetAlarmTrendAsync(StatisticsQueryDto query);
    Task<ApiResponse<List<FailureRateByTypeDto>>> GetFailureRateByDeviceTypeAsync(StatisticsQueryDto query);
    Task<ApiResponse<List<AlarmHandleEfficiencyDto>>> GetAlarmHandleEfficiencyAsync(StatisticsQueryDto query);
    Task<ApiResponse<List<InspectionCompletionRateDto>>> GetInspectionCompletionRateAsync(StatisticsQueryDto query);
    Task<ApiResponse<List<UnitTypeStatisticsDto>>> GetUnitTypeStatisticsAsync(StatisticsQueryDto query);
    Task<ApiResponse<MonthlySafetyReportDto>> GenerateMonthlyReportAsync(int year, int month, string? districtCode = null);
}

public interface IAuthService
{
    Task<ApiResponse<LoginResultDto>> LoginAsync(LoginDto dto);
    Task<ApiResponse<UserDto>> GetUserByIdAsync(long id);
    Task<ApiResponse<PagedResult<UserDto>>> GetUsersPagedAsync(UserQueryDto query);
    Task<ApiResponse<UserDto>> CreateUserAsync(UserCreateDto dto);
    Task<ApiResponse<bool>> UpdateUserAsync(long id, UserUpdateDto dto);
    Task<ApiResponse<bool>> DeleteUserAsync(long id);
    Task<ApiResponse<bool>> ChangePasswordAsync(ChangePasswordDto dto);
    Task<ApiResponse<bool>> ResetPasswordAsync(long userId, string newPassword);
}
