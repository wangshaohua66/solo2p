using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HazChemSupervision.Services;

public class HazardRectificationService : IHazardRectificationService
{
    private readonly IBaseRepository<HazardRectification> _hazardRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IBaseRepository<User> _userRepo;
    private readonly IAlertService _alertService;
    private readonly IMapper _mapper;

    public HazardRectificationService(
        IBaseRepository<HazardRectification> hazardRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IBaseRepository<User> userRepo,
        IAlertService alertService,
        IMapper mapper)
    {
        _hazardRepo = hazardRepo;
        _enterpriseRepo = enterpriseRepo;
        _userRepo = userRepo;
        _alertService = alertService;
        _mapper = mapper;
    }

    public async Task<HazardRectificationDto?> GetHazardByIdAsync(int id)
    {
        var hazard = await _hazardRepo.GetQueryable()
            .Include(h => h.Enterprise)
            .FirstOrDefaultAsync(h => h.Id == id);

        return hazard != null ? _mapper.Map<HazardRectificationDto>(hazard) : null;
    }

    public async Task<PagedResult<HazardRectificationDto>> GetHazardsAsync(HazardRectificationQueryDto dto)
    {
        var predicate = PredicateBuilder.True<HazardRectification>();

        if (!string.IsNullOrEmpty(dto.WorkOrderNo))
            predicate = predicate.And(h => h.WorkOrderNo.Contains(dto.WorkOrderNo));

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(h => h.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.Source.HasValue)
            predicate = predicate.And(h => h.Source == (HazardSource)dto.Source.Value);

        if (dto.Level.HasValue)
            predicate = predicate.And(h => h.Level == (HazardLevel)dto.Level.Value);

        if (dto.Status.HasValue)
            predicate = predicate.And(h => h.Status == (HazardRectificationStatus)dto.Status.Value);

        if (dto.IsEscalated.HasValue)
            predicate = predicate.And(h => h.IsEscalated == dto.IsEscalated.Value);

        if (dto.IsOverdue.HasValue)
        {
            var now = DateTime.UtcNow;
            if (dto.IsOverdue.Value)
                predicate = predicate.And(h => h.Deadline < now && h.Status != HazardRectificationStatus.Accepted && h.Status != HazardRectificationStatus.Closed);
            else
                predicate = predicate.And(h => h.Deadline >= now || h.Status == HazardRectificationStatus.Accepted || h.Status == HazardRectificationStatus.Closed);
        }

        if (dto.DiscoveryDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(h => h.DiscoveryTime >= dto.DiscoveryDateRange.StartDate.Value);

        if (dto.DiscoveryDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(h => h.DiscoveryTime < dto.DiscoveryDateRange.EndDate.Value.AddDays(1));

        if (dto.DeadlineRange?.StartDate.HasValue == true)
            predicate = predicate.And(h => h.Deadline >= dto.DeadlineRange.StartDate.Value);

        if (dto.DeadlineRange?.EndDate.HasValue == true)
            predicate = predicate.And(h => h.Deadline < dto.DeadlineRange.EndDate.Value.AddDays(1));

        var result = await _hazardRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(h => h.UpdatedAt),
            dto.PageIndex,
            dto.PageSize);

        var items = await _hazardRepo.GetQueryable()
            .Include(h => h.Enterprise)
            .Where(predicate)
            .OrderByDescending(h => h.UpdatedAt)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        var nowTime = DateTime.UtcNow;
        foreach (var item in items)
        {
            if (item.Status != HazardRectificationStatus.Accepted && item.Status != HazardRectificationStatus.Closed)
            {
                item.OverdueDays = item.Deadline < nowTime ? (int)(nowTime - item.Deadline).TotalDays : 0;
            }
        }

        return new PagedResult<HazardRectificationDto>
        {
            Items = _mapper.Map<List<HazardRectificationDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };
    }

    public async Task<HazardRectificationDto> CreateHazardAsync(HazardRectificationCreateDto dto)
    {
        var exists = await _hazardRepo.ExistsAsync(h => h.WorkOrderNo == dto.WorkOrderNo);
        if (exists)
            throw new InvalidOperationException($"工单编号已存在: {dto.WorkOrderNo}");

        var enterprise = await _enterpriseRepo.GetByIdAsync(dto.EnterpriseId) ??
            throw new KeyNotFoundException($"企业不存在: {dto.EnterpriseId}");

        if (dto.Deadline <= dto.DiscoveryTime)
            throw new InvalidOperationException("整改期限必须晚于发现时间");

        var hazard = _mapper.Map<HazardRectification>(dto);
        hazard.Status = HazardRectificationStatus.Pending;
        hazard.AcceptanceCriteria = dto.AcceptanceCriteria;
        hazard.CreatedAt = DateTime.UtcNow;
        hazard.UpdatedAt = DateTime.UtcNow;

        var result = await _hazardRepo.AddAsync(hazard);
        await _alertService.CheckAndGenerateHazardAlertsAsync();

        return _mapper.Map<HazardRectificationDto>(result);
    }

    public async Task<HazardRectificationDto> StartRectificationAsync(int id, HazardRectificationStartDto dto)
    {
        var hazard = await _hazardRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"隐患记录不存在: {id}");

        if (hazard.Status != HazardRectificationStatus.Pending)
            throw new InvalidOperationException("隐患状态不允许开始整改");

        if (dto.StartTime < hazard.DiscoveryTime)
            throw new InvalidOperationException("整改开始时间不能早于发现时间");

        hazard.RectificationMeasures = dto.RectificationMeasures;
        hazard.RectificationStartTime = dto.StartTime;
        hazard.Status = HazardRectificationStatus.InProgress;
        hazard.UpdatedAt = DateTime.UtcNow;

        await _hazardRepo.UpdateAsync(hazard);
        return _mapper.Map<HazardRectificationDto>(hazard);
    }

    public async Task<HazardRectificationDto> CompleteRectificationAsync(int id, HazardRectificationCompleteDto dto)
    {
        var hazard = await _hazardRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"隐患记录不存在: {id}");

        if (hazard.Status != HazardRectificationStatus.InProgress)
            throw new InvalidOperationException("隐患状态不允许完成整改");

        if (!hazard.RectificationStartTime.HasValue || dto.CompleteTime < hazard.RectificationStartTime.Value)
            throw new InvalidOperationException("整改完成时间不能早于开始时间");

        hazard.RectificationCompleteTime = dto.CompleteTime;
        hazard.RectificationResult = dto.RectificationResult;
        hazard.RectificationAttachmentUrl = dto.AttachmentUrl;
        hazard.Status = HazardRectificationStatus.Completed;
        hazard.UpdatedAt = DateTime.UtcNow;

        await _hazardRepo.UpdateAsync(hazard);
        return _mapper.Map<HazardRectificationDto>(hazard);
    }

    public async Task<HazardRectificationDto> InspectRectificationAsync(int id, HazardRectificationInspectionDto dto)
    {
        var hazard = await _hazardRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"隐患记录不存在: {id}");

        if (hazard.Status != HazardRectificationStatus.Completed)
            throw new InvalidOperationException("隐患状态不允许验收");

        if (dto.InspectionTime < hazard.RectificationCompleteTime)
            throw new InvalidOperationException("验收时间不能早于整改完成时间");

        hazard.InspectorId = dto.InspectorId;
        hazard.InspectorName = dto.InspectorName;
        hazard.InspectionTime = dto.InspectionTime;
        hazard.InspectionPassed = dto.InspectionPassed;
        hazard.InspectionComment = dto.InspectionComment;
        hazard.Status = dto.InspectionPassed ? HazardRectificationStatus.Accepted : HazardRectificationStatus.Rejected;
        hazard.UpdatedAt = DateTime.UtcNow;

        if (dto.InspectionPassed)
        {
            hazard.Status = HazardRectificationStatus.Closed;
        }
        else
        {
            hazard.Status = HazardRectificationStatus.InProgress;
            hazard.RectificationStartTime = DateTime.UtcNow;
        }

        await _hazardRepo.UpdateAsync(hazard);
        await _alertService.CheckAndGenerateHazardAlertsAsync();

        return _mapper.Map<HazardRectificationDto>(hazard);
    }

    public async Task<HazardRectificationDto> EscalateHazardAsync(int id, string reason)
    {
        var hazard = await _hazardRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"隐患记录不存在: {id}");

        if (hazard.Status == HazardRectificationStatus.Closed || hazard.Status == HazardRectificationStatus.Accepted)
            throw new InvalidOperationException("已关闭或已验收的隐患不能升级");

        hazard.IsEscalated = true;
        hazard.EscalationLevel += 1;
        hazard.EscalationTime = DateTime.UtcNow;
        hazard.EscalationReason = reason;
        hazard.Status = HazardRectificationStatus.Escalated;
        hazard.UpdatedAt = DateTime.UtcNow;

        await _hazardRepo.UpdateAsync(hazard);

        await _alertService.CreateAlertAsync(new AlertCreateDto
        {
            Type = (int)AlertType.HazardEscalated,
            Level = (int)AlertLevel.Critical,
            EnterpriseId = hazard.EnterpriseId,
            HazardRectificationId = hazard.Id,
            Title = $"隐患整改升级告警 - {hazard.WorkOrderNo}",
            Content = $"隐患[{hazard.WorkOrderNo}]逾期未整改，已自动升级。原因: {reason}。隐患等级: {hazard.Level}",
            Suggestion = "请立即介入督办，确保隐患按时整改完成",
            RecipientRole = "Admin,Supervisor"
        });

        return _mapper.Map<HazardRectificationDto>(hazard);
    }

    public async Task<HazardStatisticsDto> GetStatisticsAsync(int? enterpriseId = null, int? year = null, int? month = null)
    {
        var predicate = PredicateBuilder.True<HazardRectification>();

        if (enterpriseId.HasValue)
            predicate = predicate.And(h => h.EnterpriseId == enterpriseId.Value);

        if (year.HasValue)
        {
            predicate = predicate.And(h => h.DiscoveryTime.Year == year.Value);
            if (month.HasValue)
                predicate = predicate.And(h => h.DiscoveryTime.Month == month.Value);
        }

        var hazards = await _hazardRepo.GetQueryable()
            .Include(h => h.Enterprise)
            .Where(predicate)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var statistics = new HazardStatisticsDto
        {
            EnterpriseId = enterpriseId ?? 0,
            EnterpriseName = enterpriseId.HasValue ? hazards.FirstOrDefault()?.Enterprise.Name ?? string.Empty : "全部企业",
            TotalCount = hazards.Count,
            PendingCount = hazards.Count(h => h.Status == HazardRectificationStatus.Pending),
            InProgressCount = hazards.Count(h => h.Status == HazardRectificationStatus.InProgress),
            CompletedCount = hazards.Count(h => h.Status == HazardRectificationStatus.Completed),
            AcceptedCount = hazards.Count(h => h.Status == HazardRectificationStatus.Accepted || h.Status == HazardRectificationStatus.Closed),
            OverdueCount = hazards.Count(h => h.Deadline < now && h.Status != HazardRectificationStatus.Accepted && h.Status != HazardRectificationStatus.Closed),
            EscalatedCount = hazards.Count(h => h.IsEscalated),
            ClosedCount = hazards.Count(h => h.Status == HazardRectificationStatus.Closed)
        };

        statistics.LevelStatistics = hazards
            .GroupBy(h => h.Level)
            .Select(g => new HazardLevelStatistics
            {
                Level = (int)g.Key,
                LevelName = g.Key.ToString(),
                Count = g.Count()
            })
            .ToList();

        return statistics;
    }

    public async Task CheckOverdueHazardsAsync()
    {
        var now = DateTime.UtcNow;
        var overdueHazards = await _hazardRepo.GetListAsync(h =>
            h.Deadline < now &&
            h.Status != HazardRectificationStatus.Accepted &&
            h.Status != HazardRectificationStatus.Closed &&
            h.Status != HazardRectificationStatus.Escalated);

        foreach (var hazard in overdueHazards)
        {
            var overdueDays = (int)(now - hazard.Deadline).TotalDays;
            hazard.OverdueDays = overdueDays;

            if (overdueDays >= 3 && !hazard.IsEscalated)
            {
                await EscalateHazardAsync(hazard.Id, $"隐患逾期{overdueDays}天未整改，自动升级");
            }
            else
            {
                hazard.UpdatedAt = DateTime.UtcNow;
                await _hazardRepo.UpdateAsync(hazard);
            }
        }

        await _alertService.CheckAndGenerateHazardAlertsAsync();
    }
}


