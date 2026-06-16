using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Services;

public interface IStatisticsService
{
    Task<StatisticsDto> GetOverviewAsync(StatisticsQuery query);
    Task<List<CategoryStatisticsDto>> GetCategoryStatisticsAsync(StatisticsQuery query);
    Task<List<DepartmentStatisticsDto>> GetDepartmentStatisticsAsync(StatisticsQuery query);
    Task<List<DailyStatisticsDto>> GetDailyStatisticsAsync(StatisticsQuery query);
}
