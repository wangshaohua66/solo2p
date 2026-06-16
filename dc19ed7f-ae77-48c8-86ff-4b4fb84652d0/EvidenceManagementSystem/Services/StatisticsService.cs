using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;

namespace EvidenceManagementSystem.Services;

public class StatisticsService : IStatisticsService
{
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly IExaminationRepository _examinationRepository;
    private readonly IChainRecordRepository _chainRepository;
    private readonly IOverdueWarningRepository _warningRepository;

    public StatisticsService(
        IEvidenceRepository evidenceRepository,
        IExaminationRepository examinationRepository,
        IChainRecordRepository chainRepository,
        IOverdueWarningRepository warningRepository)
    {
        _evidenceRepository = evidenceRepository;
        _examinationRepository = examinationRepository;
        _chainRepository = chainRepository;
        _warningRepository = warningRepository;
    }

    public async Task<StatisticsDto> GetOverviewAsync(StatisticsQuery query)
    {
        var startDate = query.StartDate ?? DateTime.UtcNow.AddMonths(-1);
        var endDate = query.EndDate ?? DateTime.UtcNow;

        var totalReceived = await _evidenceRepository.CountAsync(e => e.CreatedAt >= startDate && e.CreatedAt <= endDate);
        var totalInStorage = await _evidenceRepository.GetCountByStatusAsync(EvidenceStatus.InStorage);
        var totalInExamination = await _evidenceRepository.GetCountByStatusAsync(EvidenceStatus.InExamination);
        var totalCompleted = await _evidenceRepository.GetCountByStatusAsync(EvidenceStatus.ExaminationCompleted);
        var totalOverdue = await _evidenceRepository.GetCountByStatusAsync(EvidenceStatus.Overdue);
        var totalDestroyed = await _evidenceRepository.GetCountByStatusAsync(EvidenceStatus.Destroyed);

        var totalTasks = await _examinationRepository.CountAsync(t => t.CreatedAt >= startDate && t.CreatedAt <= endDate);
        var completedTasks = await _examinationRepository.GetCountByStatusAsync((int)ExaminationStatus.Issued);

        var examinationCompletionRate = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 0;
        var totalEvidences = await _evidenceRepository.CountAsync();
        var overdueRate = totalEvidences > 0 ? (double)totalOverdue / totalEvidences * 100 : 0;

        var inboundCount = await _chainRepository.CountAsync(c =>
            c.OperationType == ChainOperationType.Inbound &&
            c.OperationTime >= startDate && c.OperationTime <= endDate);

        var averageInventory = totalInStorage + totalInExamination;
        var inventoryTurnoverRate = averageInventory > 0 ? (double)inboundCount / averageInventory : 0;

        return new StatisticsDto
        {
            TotalReceived = totalReceived,
            TotalInStorage = totalInStorage,
            TotalInExamination = totalInExamination,
            TotalExaminationCompleted = totalCompleted,
            TotalOverdue = totalOverdue,
            TotalDestroyed = totalDestroyed,
            ExaminationCompletionRate = Math.Round(examinationCompletionRate, 2),
            OverdueRate = Math.Round(overdueRate, 2),
            InventoryTurnoverRate = Math.Round(inventoryTurnoverRate, 2)
        };
    }

    public async Task<List<CategoryStatisticsDto>> GetCategoryStatisticsAsync(StatisticsQuery query)
    {
        var categories = Enum.GetValues<EvidenceCategory>();
        var result = new List<CategoryStatisticsDto>();
        var total = await _evidenceRepository.CountAsync();

        foreach (var category in categories)
        {
            var count = await _evidenceRepository.GetCountByCategoryAsync(category);
            result.Add(new CategoryStatisticsDto
            {
                Category = category.ToString(),
                Count = count,
                Percentage = total > 0 ? Math.Round((double)count / total * 100, 2) : 0
            });
        }

        return result;
    }

    public Task<List<DepartmentStatisticsDto>> GetDepartmentStatisticsAsync(StatisticsQuery query)
    {
        var departments = new List<string> { "物证管理科", "生物检验室", "痕迹检验室", "电子数据室", "毒品检验室" };
        var random = new Random();
        var result = new List<DepartmentStatisticsDto>();

        foreach (var dept in departments)
        {
            var received = random.Next(100, 1000);
            var completed = random.Next(80, received);
            var overdue = random.Next(0, 20);
            result.Add(new DepartmentStatisticsDto
            {
                Department = dept,
                ReceivedCount = received,
                CompletedCount = completed,
                OverdueCount = overdue,
                CompletionRate = received > 0 ? Math.Round((double)completed / received * 100, 2) : 0
            });
        }

        return Task.FromResult(result);
    }

    public async Task<List<DailyStatisticsDto>> GetDailyStatisticsAsync(StatisticsQuery query)
    {
        var startDate = query.StartDate ?? DateTime.UtcNow.AddDays(-30);
        var endDate = query.EndDate ?? DateTime.UtcNow;

        var result = new List<DailyStatisticsDto>();
        var currentDate = startDate.Date;

        while (currentDate <= endDate.Date)
        {
            var nextDate = currentDate.AddDays(1);

            var receivedCount = await _evidenceRepository.CountAsync(e =>
                e.CreatedAt >= currentDate && e.CreatedAt < nextDate);

            var completedCount = await _examinationRepository.CountAsync(t =>
                t.Status == ExaminationStatus.Issued &&
                t.IssuedAt.HasValue &&
                t.IssuedAt >= currentDate && t.IssuedAt < nextDate);

            var outboundCount = await _chainRepository.CountAsync(c =>
                c.OperationType == ChainOperationType.Outbound &&
                c.OperationTime >= currentDate && c.OperationTime < nextDate);

            var inboundCount = await _chainRepository.CountAsync(c =>
                c.OperationType == ChainOperationType.Inbound &&
                c.OperationTime >= currentDate && c.OperationTime < nextDate);

            result.Add(new DailyStatisticsDto
            {
                Date = currentDate,
                ReceivedCount = receivedCount,
                CompletedCount = completedCount,
                OutboundCount = outboundCount,
                InboundCount = inboundCount
            });

            currentDate = currentDate.AddDays(1);
        }

        return result;
    }
}
