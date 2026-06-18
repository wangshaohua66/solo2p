using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HazChemSupervision.Services;

public class EmergencyDrillService : IEmergencyDrillService
{
    private readonly IBaseRepository<EmergencyDrill> _drillRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IAlertService _alertService;
    private readonly IMapper _mapper;

    public EmergencyDrillService(
        IBaseRepository<EmergencyDrill> drillRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IAlertService alertService,
        IMapper mapper)
    {
        _drillRepo = drillRepo;
        _enterpriseRepo = enterpriseRepo;
        _alertService = alertService;
        _mapper = mapper;
    }

    public async Task<EmergencyDrillDto?> GetDrillByIdAsync(int id)
    {
        var drill = await _drillRepo.GetQueryable()
            .Include(d => d.Enterprise)
            .FirstOrDefaultAsync(d => d.Id == id);

        return drill != null ? _mapper.Map<EmergencyDrillDto>(drill) : null;
    }

    public async Task<PagedResult<EmergencyDrillDto>> GetDrillsAsync(EmergencyDrillQueryDto dto)
    {
        var predicate = PredicateBuilder.True<EmergencyDrill>();

        if (!string.IsNullOrEmpty(dto.PlanNo))
            predicate = predicate.And(d => d.PlanNo.Contains(dto.PlanNo));

        if (!string.IsNullOrEmpty(dto.Name))
            predicate = predicate.And(d => d.Name.Contains(dto.Name));

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(d => d.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.Type.HasValue)
            predicate = predicate.And(d => d.Type == (DrillType)dto.Type.Value);

        if (dto.Status.HasValue)
            predicate = predicate.And(d => d.Status == (DrillStatus)dto.Status.Value);

        if (dto.Year.HasValue)
            predicate = predicate.And(d => d.Year == dto.Year.Value);

        if (dto.Quarter.HasValue)
            predicate = predicate.And(d => d.Quarter == dto.Quarter.Value);

        if (dto.PlannedDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(d => d.PlannedStartTime >= dto.PlannedDateRange.StartDate.Value);

        if (dto.PlannedDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(d => d.PlannedStartTime < dto.PlannedDateRange.EndDate.Value.AddDays(1));

        if (dto.IsOverdue.HasValue)
        {
            var now = DateTime.UtcNow;
            if (dto.IsOverdue.Value)
                predicate = predicate.And(d => d.PlannedEndTime < now && d.Status != DrillStatus.Completed && d.Status != DrillStatus.Evaluated && d.Status != DrillStatus.Cancelled);
            else
                predicate = predicate.And(d => d.PlannedEndTime >= now || d.Status == DrillStatus.Completed || d.Status == DrillStatus.Evaluated || d.Status == DrillStatus.Cancelled);
        }

        var result = await _drillRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(d => d.UpdatedAt),
            dto.PageIndex,
            dto.PageSize);

        var items = await _drillRepo.GetQueryable()
            .Include(d => d.Enterprise)
            .Where(predicate)
            .OrderByDescending(d => d.UpdatedAt)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        return new PagedResult<EmergencyDrillDto>
        {
            Items = _mapper.Map<List<EmergencyDrillDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };
    }

    public async Task<EmergencyDrillDto> CreateDrillAsync(EmergencyDrillCreateDto dto)
    {
        var exists = await _drillRepo.ExistsAsync(d => d.PlanNo == dto.PlanNo);
        if (exists)
            throw new InvalidOperationException($"演练计划编号已存在: {dto.PlanNo}");

        var enterprise = await _enterpriseRepo.GetByIdAsync(dto.EnterpriseId) ??
            throw new KeyNotFoundException($"企业不存在: {dto.EnterpriseId}");

        if (dto.PlannedEndTime <= dto.PlannedStartTime)
            throw new InvalidOperationException("计划结束时间必须晚于开始时间");

        var drill = _mapper.Map<EmergencyDrill>(dto);
        drill.Status = DrillStatus.Planned;
        drill.CreatedAt = DateTime.UtcNow;
        drill.UpdatedAt = DateTime.UtcNow;

        var result = await _drillRepo.AddAsync(drill);
        await _alertService.CheckAndGenerateDrillAlertsAsync();

        return _mapper.Map<EmergencyDrillDto>(result);
    }

    public async Task<EmergencyDrillDto> StartDrillAsync(int id, EmergencyDrillStartDto dto)
    {
        var drill = await _drillRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"演练记录不存在: {id}");

        if (drill.Status != DrillStatus.Planned && drill.Status != DrillStatus.Scheduled)
            throw new InvalidOperationException("演练状态不允许开始");

        if (dto.StartTime < drill.PlannedStartTime.AddDays(-1) || dto.StartTime > drill.PlannedStartTime.AddDays(1))
            throw new InvalidOperationException("实际开始时间与计划时间偏差过大");

        drill.ActualStartTime = dto.StartTime;
        drill.ActualParticipants = dto.ActualParticipants;
        drill.ParticipantsList = dto.ParticipantsList;
        drill.MaterialsUsed = dto.MaterialsUsed;
        drill.Status = DrillStatus.InProgress;
        drill.UpdatedAt = DateTime.UtcNow;

        await _drillRepo.UpdateAsync(drill);
        return _mapper.Map<EmergencyDrillDto>(drill);
    }

    public async Task<EmergencyDrillDto> CompleteDrillAsync(int id, EmergencyDrillCompleteDto dto)
    {
        var drill = await _drillRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"演练记录不存在: {id}");

        if (drill.Status != DrillStatus.InProgress)
            throw new InvalidOperationException("演练状态不允许完成");

        if (!drill.ActualStartTime.HasValue || dto.EndTime < drill.ActualStartTime.Value)
            throw new InvalidOperationException("实际结束时间不能早于开始时间");

        drill.ActualEndTime = dto.EndTime;
        drill.ExecutionRecord = dto.ExecutionRecord;
        drill.ProblemsFound = dto.ProblemsFound;
        drill.ActualCost = dto.ActualCost;
        drill.Status = DrillStatus.Completed;
        drill.UpdatedAt = DateTime.UtcNow;

        await _drillRepo.UpdateAsync(drill);
        return _mapper.Map<EmergencyDrillDto>(drill);
    }

    public async Task<EmergencyDrillDto> EvaluateDrillAsync(int id, EmergencyDrillEvaluateDto dto)
    {
        var drill = await _drillRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"演练记录不存在: {id}");

        if (drill.Status != DrillStatus.Completed)
            throw new InvalidOperationException("演练状态不允许评估");

        if (dto.EvaluationTime < drill.ActualEndTime)
            throw new InvalidOperationException("评估时间不能早于演练结束时间");

        drill.EvaluationResult = (DrillEvaluationResult)dto.EvaluationResult;
        drill.EvaluationComment = dto.EvaluationComment;
        drill.EvaluatorId = dto.EvaluatorId;
        drill.EvaluatorName = dto.EvaluatorName;
        drill.EvaluationTime = dto.EvaluationTime;
        drill.ImprovementMeasures = dto.ImprovementMeasures;
        drill.ReportUrl = dto.ReportUrl;
        drill.Status = DrillStatus.Evaluated;
        drill.UpdatedAt = DateTime.UtcNow;

        await _drillRepo.UpdateAsync(drill);
        await _alertService.CheckAndGenerateDrillAlertsAsync();

        return _mapper.Map<EmergencyDrillDto>(drill);
    }

    public async Task<DrillStatisticsDto> GetStatisticsAsync(int year, int? quarter = null, int? enterpriseId = null)
    {
        var predicate = PredicateBuilder.True<EmergencyDrill>()
            .And(d => d.Year == year);

        if (quarter.HasValue)
            predicate = predicate.And(d => d.Quarter == quarter.Value);

        if (enterpriseId.HasValue)
            predicate = predicate.And(d => d.EnterpriseId == enterpriseId.Value);

        var drills = await _drillRepo.GetQueryable()
            .Include(d => d.Enterprise)
            .Where(predicate)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var statistics = new DrillStatisticsDto
        {
            Year = year,
            Quarter = quarter,
            EnterpriseId = enterpriseId,
            EnterpriseName = enterpriseId.HasValue ? drills.FirstOrDefault()?.Enterprise.Name ?? string.Empty : "全部企业",
            PlannedCount = drills.Count,
            CompletedCount = drills.Count(d => d.Status == DrillStatus.Completed || d.Status == DrillStatus.Evaluated),
            EvaluatedCount = drills.Count(d => d.Status == DrillStatus.Evaluated),
            OverdueCount = drills.Count(d => d.PlannedEndTime < now && d.Status != DrillStatus.Completed && d.Status != DrillStatus.Evaluated && d.Status != DrillStatus.Cancelled),
            CancelledCount = drills.Count(d => d.Status == DrillStatus.Cancelled)
        };

        statistics.TypeStatistics = drills
            .GroupBy(d => d.Type)
            .Select(g => new DrillTypeStatistics
            {
                Type = (int)g.Key,
                TypeName = g.Key.ToString(),
                Count = g.Count()
            })
            .ToList();

        return statistics;
    }

    public async Task<List<DrillSupervisionDto>> GetOverdueDrillsAsync()
    {
        var now = DateTime.UtcNow;
        var overdueDrills = await _drillRepo.GetQueryable()
            .Include(d => d.Enterprise)
            .Where(d => d.PlannedEndTime < now &&
                        d.Status != DrillStatus.Completed &&
                        d.Status != DrillStatus.Evaluated &&
                        d.Status != DrillStatus.Cancelled)
            .OrderBy(d => d.PlannedEndTime)
            .ToListAsync();

        return overdueDrills.Select(d => new DrillSupervisionDto
        {
            DrillId = d.Id,
            PlanNo = d.PlanNo,
            Name = d.Name,
            EnterpriseId = d.EnterpriseId,
            EnterpriseName = d.Enterprise.Name,
            PlannedStartTime = d.PlannedStartTime,
            Status = (int)d.Status,
            StatusName = d.Status.ToString(),
            OverdueDays = (int)(now - d.PlannedEndTime).TotalDays,
            ReminderCount = d.SupervisionReminderCount ?? 0
        }).ToList();
    }

    public async Task SendSupervisionReminderAsync(int drillId)
    {
        var drill = await _drillRepo.GetByIdAsync(drillId) ??
            throw new KeyNotFoundException($"演练记录不存在: {drillId}");

        drill.HasSupervisionReminder = true;
        drill.SupervisionReminderCount = (drill.SupervisionReminderCount ?? 0) + 1;
        drill.LastSupervisionReminderTime = DateTime.UtcNow;
        drill.UpdatedAt = DateTime.UtcNow;

        await _drillRepo.UpdateAsync(drill);

        await _alertService.CreateAlertAsync(new AlertCreateDto
        {
            Type = (int)AlertType.DrillSupervision,
            Level = (int)AlertLevel.Warning,
            EnterpriseId = drill.EnterpriseId,
            EmergencyDrillId = drill.Id,
            Title = $"应急演练督办提醒 - {drill.PlanNo}",
            Content = $"演练[{drill.Name}]计划于{drill.PlannedStartTime:yyyy-MM-dd}执行，目前已逾期{(int)(DateTime.UtcNow - drill.PlannedEndTime).TotalDays}天，请尽快组织实施。",
            Suggestion = "请立即安排演练，并在演练完成后上传演练记录和评估报告",
            RecipientRole = "Supervisor,Enterprise"
        });
    }

    public async Task CheckDrillExecutionStatusAsync()
    {
        var now = DateTime.UtcNow;
        var overdueDrills = await _drillRepo.GetListAsync(d =>
            d.PlannedEndTime < now &&
            d.Status != DrillStatus.Completed &&
            d.Status != DrillStatus.Evaluated &&
            d.Status != DrillStatus.Cancelled);

        foreach (var drill in overdueDrills)
        {
            var overdueDays = (int)(now - drill.PlannedEndTime).TotalDays;

            if (overdueDays >= 7 && (drill.SupervisionReminderCount ?? 0) == 0)
            {
                await SendSupervisionReminderAsync(drill.Id);
            }
            else if (overdueDays >= 14 && (drill.SupervisionReminderCount ?? 0) < 2)
            {
                drill.Status = DrillStatus.Overdue;
                drill.UpdatedAt = DateTime.UtcNow;
                await _drillRepo.UpdateAsync(drill);
                await SendSupervisionReminderAsync(drill.Id);
            }
        }

        await _alertService.CheckAndGenerateDrillAlertsAsync();
    }
}
