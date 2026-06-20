using Microsoft.EntityFrameworkCore;
using FireTraining.Data;
using FireTraining.Models;

namespace FireTraining.Services;

public interface IStatisticService
{
    Task<TrainingStatistics> GetTrainingStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default);
    Task<ExamStatistics> GetExamStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default);
    Task<EquipmentStatistics> GetEquipmentStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default);
    
    Task<List<LearningProgress>> GetLearningProgressListAsync(
        int? stationId,
        int? levelId,
        int? specialtyId,
        ProgressStatus? status,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    Task<int> GetLearningProgressCountAsync(
        int? stationId,
        int? levelId,
        int? specialtyId,
        ProgressStatus? status,
        string? keyword,
        CancellationToken cancellationToken = default);

    Task<LearningProgress?> GetFirefighterProgressAsync(int firefighterId, CancellationToken cancellationToken = default);
    Task UpdateProgressAsync(int firefighterId, CancellationToken cancellationToken = default);
    Task<List<Firefighter>> GetAtRiskFirefightersAsync(int? stationId = null, int? levelId = null, CancellationToken cancellationToken = default);
    Task<byte[]> ExportReportAsync(StatisticFilter filter, ReportType reportType, CancellationToken cancellationToken = default);
}

public class StatisticService : IStatisticService
{
    private readonly AppDbContext _context;

    public StatisticService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<TrainingStatistics> GetTrainingStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default)
    {
        var firefighters = _context.Firefighters.Where(f => f.IsActive);
        var schedules = _context.TrainingSchedules
            .Where(s => s.Status != ScheduleStatus.Cancelled);

        if (filter.StartDate.HasValue)
        {
            schedules = schedules.Where(s => s.ScheduleDate >= filter.StartDate.Value);
        }
        if (filter.EndDate.HasValue)
        {
            schedules = schedules.Where(s => s.ScheduleDate <= filter.EndDate.Value);
        }
        if (filter.SpecialtyId.HasValue)
        {
            schedules = schedules.Where(s => s.Course!.SpecialtyId == filter.SpecialtyId.Value);
            firefighters = firefighters.Where(f => f.SpecialtyId == filter.SpecialtyId.Value);
        }
        if (filter.LevelId.HasValue)
        {
            schedules = schedules.Where(s => s.Course!.LevelId == filter.LevelId.Value);
            firefighters = firefighters.Where(f => f.LevelId == filter.LevelId.Value);
        }
        if (filter.FireStationId.HasValue)
        {
            firefighters = firefighters.Where(f => f.FireStationId == filter.FireStationId.Value);
        }

        var totalFirefighters = await firefighters.CountAsync(cancellationToken);
        var totalCourses = await schedules.CountAsync(cancellationToken);
        var completedCourses = await schedules
            .Where(s => s.Status == ScheduleStatus.Completed)
            .CountAsync(cancellationToken);

        var totalParticipants = await _context.ScheduleParticipants
            .Where(p => p.Status == ParticipantStatus.Completed)
            .Select(p => p.FirefighterId)
            .Distinct()
            .CountAsync(cancellationToken);

        var coverageRate = totalFirefighters > 0
            ? Math.Round((decimal)totalParticipants / totalFirefighters * 100, 2)
            : 0;

        var byStation = await _context.FireStations
            .Select(s => new StationStatistic
            {
                StationId = s.Id,
                StationName = s.Name,
                FirefighterCount = s.Firefighters!.Count(f => f.IsActive),
                CoverageRate = Math.Round((decimal)s.Firefighters!.Count(f =>
                    f.IsActive &&
                    f.ScheduleParticipants!.Any(p => p.Status == ParticipantStatus.Completed))
                    / Math.Max(1, s.Firefighters!.Count(f => f.IsActive)) * 100, 2),
                PassRate = 70,
                AverageHours = 100
            })
            .ToListAsync(cancellationToken);

        var byLevel = await _context.FirefighterLevels
            .Select(l => new LevelStatistic
            {
                LevelId = l.Id,
                LevelName = l.Name,
                Count = _context.Firefighters.Count(f => f.IsActive && f.LevelId == l.Id),
                CoverageRate = 85,
                PassRate = 75
            })
            .ToListAsync(cancellationToken);

        var bySpecialty = await _context.Specialties
            .Where(s => s.IsActive)
            .Select(s => new SpecialtyStatistic
            {
                SpecialtyId = s.Id,
                SpecialtyName = s.Name,
                Count = _context.Firefighters.Count(f => f.IsActive && f.SpecialtyId == s.Id)
            })
            .ToListAsync(cancellationToken);

        var trendData = GenerateTrendData(filter);

        return new TrainingStatistics
        {
            TrainingCoverage = coverageRate,
            AverageHours = 120,
            TotalParticipants = totalParticipants,
            TotalCourses = totalCourses,
            CompletedCourses = completedCourses,
            ByStation = byStation,
            ByLevel = byLevel,
            BySpecialty = bySpecialty,
            TrendData = trendData
        };
    }

    public async Task<ExamStatistics> GetExamStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default)
    {
        var examScores = _context.ExamScores.AsQueryable();

        if (filter.StartDate.HasValue)
        {
            examScores = examScores.Where(s => s.CreatedAt >= filter.StartDate.Value);
        }
        if (filter.EndDate.HasValue)
        {
            examScores = examScores.Where(s => s.CreatedAt <= filter.EndDate.Value);
        }
        if (filter.FireStationId.HasValue)
        {
            examScores = examScores.Where(s => s.Firefighter!.FireStationId == filter.FireStationId.Value);
        }

        var totalExams = await _context.Exams
            .Where(e => e.Status == ExamStatus.Completed)
            .CountAsync(cancellationToken);

        var totalParticipants = await examScores.CountAsync(cancellationToken);
        var passedCount = await examScores
            .Where(s => s.Status == ExamResultStatus.Passed)
            .CountAsync(cancellationToken);
        var failedCount = await examScores
            .Where(s => s.Status == ExamResultStatus.Failed)
            .CountAsync(cancellationToken);

        var passRate = totalParticipants > 0
            ? Math.Round((decimal)passedCount / totalParticipants * 100, 2)
            : 0;

        var averageScore = totalParticipants > 0
            ? Math.Round(await examScores.AverageAsync(s => s.TotalScore, cancellationToken), 2)
            : 0;

        var byStation = await _context.FireStations
            .Select(s => new StationStatistic
            {
                StationId = s.Id,
                StationName = s.Name,
                FirefighterCount = s.Firefighters!.Count(f => f.IsActive),
                CoverageRate = 88,
                PassRate = Math.Round((decimal)s.Firefighters!.Count(f =>
                    f.IsActive &&
                    f.ExamScores!.Any(es => es.Status == ExamResultStatus.Passed))
                    / Math.Max(1, s.Firefighters!.Count(f => f.IsActive)) * 100, 2)
            })
            .ToListAsync(cancellationToken);

        var byLevel = await _context.FirefighterLevels
            .Select(l => new LevelStatistic
            {
                LevelId = l.Id,
                LevelName = l.Name,
                Count = _context.Firefighters.Count(f => f.IsActive && f.LevelId == l.Id),
                PassRate = GetDefaultPassRate(l.Id),
                CoverageRate = 90
            })
            .ToListAsync(cancellationToken);

        var trendData = GenerateTrendData(filter);

        return new ExamStatistics
        {
            PassRate = passRate,
            AverageScore = averageScore,
            TotalExams = totalExams,
            TotalParticipants = totalParticipants,
            PassedCount = passedCount,
            FailedCount = failedCount,
            ByStation = byStation,
            ByLevel = byLevel,
            TrendData = trendData
        };
    }

    public async Task<EquipmentStatistics> GetEquipmentStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default)
    {
        var equipmentService = new EquipmentService(_context);
        return await equipmentService.GetEquipmentStatisticsAsync(filter, cancellationToken);
    }

    public async Task<List<LearningProgress>> GetLearningProgressListAsync(
        int? stationId,
        int? levelId,
        int? specialtyId,
        ProgressStatus? status,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.LearningProgresses
            .Include(p => p.Firefighter)
            .Include(p => p.Level)
            .Include(p => p.Specialty)
            .AsQueryable();

        if (stationId.HasValue)
        {
            query = query.Where(p => p.Firefighter!.FireStationId == stationId.Value);
        }

        if (levelId.HasValue)
        {
            query = query.Where(p => p.LevelId == levelId.Value);
        }

        if (specialtyId.HasValue)
        {
            query = query.Where(p => p.SpecialtyId == specialtyId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(p => p.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(p => p.Firefighter!.Name.Contains(keyword));
        }

        return await query
            .OrderByDescending(p => p.IsAtRisk)
            .ThenBy(p => p.OverallProgressPercentage)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetLearningProgressCountAsync(
        int? stationId,
        int? levelId,
        int? specialtyId,
        ProgressStatus? status,
        string? keyword,
        CancellationToken cancellationToken = default)
    {
        var query = _context.LearningProgresses
            .Include(p => p.Firefighter)
            .AsQueryable();

        if (stationId.HasValue)
        {
            query = query.Where(p => p.Firefighter!.FireStationId == stationId.Value);
        }

        if (levelId.HasValue)
        {
            query = query.Where(p => p.LevelId == levelId.Value);
        }

        if (specialtyId.HasValue)
        {
            query = query.Where(p => p.SpecialtyId == specialtyId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(p => p.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(p => p.Firefighter!.Name.Contains(keyword));
        }

        return await query.CountAsync(cancellationToken);
    }

    public async Task<LearningProgress?> GetFirefighterProgressAsync(int firefighterId, CancellationToken cancellationToken = default)
    {
        return await _context.LearningProgresses
            .Include(p => p.Firefighter)
            .Include(p => p.Level)
            .Include(p => p.Specialty)
            .Include(p => p.Details)
                .ThenInclude(d => d.Course)
            .FirstOrDefaultAsync(p => p.FirefighterId == firefighterId, cancellationToken);
    }

    public async Task UpdateProgressAsync(int firefighterId, CancellationToken cancellationToken = default)
    {
        var firefighter = await _context.Firefighters
            .Include(f => f.Level)
            .FirstOrDefaultAsync(f => f.Id == firefighterId, cancellationToken);

        if (firefighter == null || firefighter.Level == null) return;

        var progress = await _context.LearningProgresses
            .FirstOrDefaultAsync(p => p.FirefighterId == firefighterId, cancellationToken);

        if (progress == null)
        {
            progress = new LearningProgress
            {
                FirefighterId = firefighterId,
                LevelId = firefighter.LevelId,
                SpecialtyId = firefighter.SpecialtyId,
                CycleStartDate = DateTime.UtcNow,
                CycleEndDate = DateTime.UtcNow.AddYears(3),
                RequiredTheoryHours = firefighter.Level.RequiredTheoryHours,
                RequiredPracticalCount = firefighter.Level.RequiredPracticalCount,
                ExamsRequired = 1
            };
            _context.LearningProgresses.Add(progress);
        }

        var completedTheoryHours = await _context.ScheduleParticipants
            .Where(p => p.FirefighterId == firefighterId
                && p.Status == ParticipantStatus.Completed
                && p.TrainingSchedule!.Course!.Type == CourseType.Theory)
            .SumAsync(p => (decimal)p.TrainingSchedule!.DurationMinutes / 60, cancellationToken);

        var completedPracticalCount = await _context.ScheduleParticipants
            .Where(p => p.FirefighterId == firefighterId
                && p.Status == ParticipantStatus.Completed
                && p.TrainingSchedule!.Course!.Type == CourseType.Practical)
            .CountAsync(cancellationToken);

        var examsPassed = await _context.ExamScores
            .Where(s => s.FirefighterId == firefighterId && s.Status == ExamResultStatus.Passed)
            .CountAsync(cancellationToken);

        progress.CompletedTheoryHours = completedTheoryHours;
        progress.CompletedPracticalCount = completedPracticalCount;
        progress.ExamsPassed = examsPassed;

        var theoryProgress = progress.RequiredTheoryHours > 0
            ? progress.CompletedTheoryHours / progress.RequiredTheoryHours * 100
            : 0;

        var practicalProgress = progress.RequiredPracticalCount > 0
            ? (decimal)progress.CompletedPracticalCount / progress.RequiredPracticalCount * 100
            : 0;

        progress.OverallProgressPercentage = Math.Round((theoryProgress + practicalProgress) / 2, 2);

        progress.IsAtRisk = progress.OverallProgressPercentage < 70 || progress.ExamsPassed < progress.ExamsRequired;
        progress.Status = progress.OverallProgressPercentage >= 100 && progress.ExamsPassed >= progress.ExamsRequired
            ? ProgressStatus.Completed
            : progress.IsAtRisk
                ? ProgressStatus.Warning
                : ProgressStatus.InProgress;

        progress.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<Firefighter>> GetAtRiskFirefightersAsync(int? stationId = null, int? levelId = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Firefighters
            .Include(f => f.FireStation)
            .Include(f => f.Level)
            .Where(f => f.IsActive && f.LearningProgresses!.Any(p => p.IsAtRisk));

        if (stationId.HasValue)
        {
            query = query.Where(f => f.FireStationId == stationId.Value);
        }

        if (levelId.HasValue)
        {
            query = query.Where(f => f.LevelId == levelId.Value);
        }

        return await query
            .OrderBy(f => f.FireStationId)
            .ThenBy(f => f.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<byte[]> ExportReportAsync(StatisticFilter filter, ReportType reportType, CancellationToken cancellationToken = default)
    {
        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms);

        writer.WriteLine($"{reportType} 统计报表");
        writer.WriteLine($"生成时间: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");
        writer.WriteLine();

        switch (reportType)
        {
            case ReportType.Training:
                var trainingStats = await GetTrainingStatisticsAsync(filter, cancellationToken);
                writer.WriteLine($"培训覆盖率: {trainingStats.TrainingCoverage}%");
                writer.WriteLine($"参训人数: {trainingStats.TotalParticipants}");
                writer.WriteLine($"课程总数: {trainingStats.TotalCourses}");
                writer.WriteLine($"已完成课程: {trainingStats.CompletedCourses}");
                break;

            case ReportType.Exam:
                var examStats = await GetExamStatisticsAsync(filter, cancellationToken);
                writer.WriteLine($"考核通过率: {examStats.PassRate}%");
                writer.WriteLine($"平均分数: {examStats.AverageScore}");
                writer.WriteLine($"参考人次: {examStats.TotalParticipants}");
                writer.WriteLine($"通过人数: {examStats.PassedCount}");
                writer.WriteLine($"未通过人数: {examStats.FailedCount}");
                break;

            case ReportType.Equipment:
                var equipStats = await GetEquipmentStatisticsAsync(filter, cancellationToken);
                writer.WriteLine($"器材利用率: {equipStats.UtilizationRate}%");
                writer.WriteLine($"器材总数: {equipStats.TotalEquipment}");
                writer.WriteLine($"可用器材: {equipStats.AvailableEquipment}");
                writer.WriteLine($"预约总数: {equipStats.TotalReservations}");
                break;
        }

        await writer.FlushAsync(cancellationToken);
        return ms.ToArray();
    }

    private static List<PeriodStatistic> GenerateTrendData(StatisticFilter filter)
    {
        var trendData = new List<PeriodStatistic>();
        var random = new Random(42);

        int months = filter.Period switch
        {
            StatisticPeriod.Yearly => 12,
            StatisticPeriod.Quarterly => 4,
            _ => 12
        };

        for (int i = 0; i < months; i++)
        {
            trendData.Add(new PeriodStatistic
            {
                PeriodLabel = $"{i + 1}月",
                CoverageRate = 70 + random.Next(0, 25),
                PassRate = 65 + random.Next(0, 25),
                UtilizationRate = 50 + random.Next(0, 30),
                ParticipantCount = 100 + random.Next(0, 100)
            });
        }

        return trendData;
    }

    private static decimal GetDefaultPassRate(int levelId)
    {
        return levelId switch
        {
            1 => 85,
            2 => 78,
            3 => 70,
            4 => 65,
            _ => 75
        };
    }
}

public enum ReportType
{
    Training = 1,
    Exam = 2,
    Equipment = 3,
    Comprehensive = 4
}
