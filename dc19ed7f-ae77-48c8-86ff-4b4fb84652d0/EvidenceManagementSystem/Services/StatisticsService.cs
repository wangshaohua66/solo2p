using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Services;

public class StatisticsService : IStatisticsService
{
    private readonly AppDbContext _context;
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly IExaminationRepository _examinationRepository;
    private readonly IChainRecordRepository _chainRepository;
    private readonly IOverdueWarningRepository _warningRepository;
    private readonly IUserRepository _userRepository;

    public StatisticsService(
        AppDbContext context,
        IEvidenceRepository evidenceRepository,
        IExaminationRepository examinationRepository,
        IChainRecordRepository chainRepository,
        IOverdueWarningRepository warningRepository,
        IUserRepository userRepository)
    {
        _context = context;
        _evidenceRepository = evidenceRepository;
        _examinationRepository = examinationRepository;
        _chainRepository = chainRepository;
        _warningRepository = warningRepository;
        _userRepository = userRepository;
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

    public async Task<List<DepartmentStatisticsDto>> GetDepartmentStatisticsAsync(StatisticsQuery query)
    {
        var startDate = query.StartDate ?? DateTime.UtcNow.AddMonths(-1);
        var endDate = query.EndDate ?? DateTime.UtcNow;

        var result = await _context.Users
            .Where(u => !string.IsNullOrEmpty(u.Department))
            .GroupJoin(
                _context.Evidences
                    .Where(e => e.CreatedAt >= startDate && e.CreatedAt <= endDate),
                u => u.Id,
                e => e.CreatedBy,
                (u, evidences) => new { u, evidences })
            .SelectMany(
                g => g.evidences.DefaultIfEmpty(),
                (g, ev) => new { g.u, ev })
            .GroupJoin(
                _context.ExaminationTasks
                    .Where(t => t.CreatedAt >= startDate && t.CreatedAt <= endDate),
                g => g.u.Id,
                t => t.ExaminerId,
                (g, tasks) => new { g.u, g.ev, tasks })
            .SelectMany(
                g => g.tasks.DefaultIfEmpty(),
                (g, task) => new { g.u, g.ev, task })
            .GroupBy(g => g.u.Department!)
            .Select(g => new
            {
                Department = g.Key,
                ReceivedCount = g.Count(x => x.ev != null),
                TotalTasks = g.Count(x => x.task != null),
                CompletedCount = g.Count(x =>
                    x.task != null &&
                    x.task.Status == ExaminationStatus.Issued &&
                    x.task.IssuedAt.HasValue &&
                    x.task.IssuedAt >= startDate &&
                    x.task.IssuedAt <= endDate),
                OverdueCount = g.Count(x =>
                    x.task != null &&
                    x.task.Status == ExaminationStatus.Issued &&
                    x.task.IssuedAt.HasValue &&
                    x.task.CreatedAt.AddDays(7) < x.task.IssuedAt)
            })
            .ToListAsync();

        return result.Select(r => new DepartmentStatisticsDto
        {
            Department = r.Department,
            ReceivedCount = r.ReceivedCount,
            CompletedCount = r.CompletedCount,
            OverdueCount = r.OverdueCount,
            CompletionRate = r.TotalTasks > 0
                ? Math.Round((double)r.CompletedCount / r.TotalTasks * 100, 2)
                : 0
        }).ToList();
    }

    public async Task<List<DailyStatisticsDto>> GetDailyStatisticsAsync(StatisticsQuery query)
    {
        var startDate = query.StartDate ?? DateTime.UtcNow.AddDays(-30);
        var endDate = query.EndDate ?? DateTime.UtcNow;
        startDate = startDate.Date;
        endDate = endDate.Date;

        var dates = Enumerable.Range(0, (endDate - startDate).Days + 1)
            .Select(offset => startDate.AddDays(offset))
            .ToList();

        var receivedByDay = await _context.Evidences
            .Where(e => e.CreatedAt >= startDate && e.CreatedAt <= endDate.AddDays(1))
            .GroupBy(e => e.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Date, x => x.Count);

        var completedByDay = await _context.ExaminationTasks
            .Where(t =>
                t.Status == ExaminationStatus.Issued &&
                t.IssuedAt.HasValue &&
                t.IssuedAt >= startDate && t.IssuedAt <= endDate.AddDays(1))
            .GroupBy(t => t.IssuedAt!.Value.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Date, x => x.Count);

        var chainByDay = await _context.ChainRecords
            .Where(c =>
                (c.OperationType == ChainOperationType.Outbound || c.OperationType == ChainOperationType.Inbound) &&
                c.OperationTime >= startDate && c.OperationTime <= endDate.AddDays(1))
            .GroupBy(c => new { c.OperationTime.Date, c.OperationType })
            .Select(g => new { g.Key.Date, g.Key.OperationType, Count = g.Count() })
            .ToDictionaryAsync(x => (x.Date, x.OperationType), x => x.Count);

        var result = new List<DailyStatisticsDto>();
        foreach (var date in dates)
        {
            receivedByDay.TryGetValue(date, out var receivedCount);
            completedByDay.TryGetValue(date, out var completedCount);
            chainByDay.TryGetValue((date, ChainOperationType.Outbound), out var outboundCount);
            chainByDay.TryGetValue((date, ChainOperationType.Inbound), out var inboundCount);

            result.Add(new DailyStatisticsDto
            {
                Date = date,
                ReceivedCount = receivedCount,
                CompletedCount = completedCount,
                OutboundCount = outboundCount,
                InboundCount = inboundCount
            });
        }

        return result;
    }
}
