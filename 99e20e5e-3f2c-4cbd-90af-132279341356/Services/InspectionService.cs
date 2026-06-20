using Microsoft.EntityFrameworkCore;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Inspection;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;

namespace FireIoTPlatform.Services;

public class InspectionService : IInspectionService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<InspectionService> _logger;

    public InspectionService(IUnitOfWork unitOfWork, ILogger<InspectionService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ApiResponse<InspectionTaskDto>> GetTaskByIdAsync(long id)
    {
        var task = await _unitOfWork.InspectionTasks.GetByIdAsync(id);
        if (task == null || task.IsDeleted) return ApiResponse<InspectionTaskDto>.Error(404, "巡检任务不存在");
        return ApiResponse<InspectionTaskDto>.Success(await MapTaskToDtoAsync(task));
    }

    public async Task<ApiResponse<PagedResult<InspectionTaskDto>>> GetTasksPagedAsync(InspectionTaskQueryDto query)
    {
        var predicate = PredicateBuilder.True<InspectionTask>().And(t => !t.IsDeleted);
        if (query.Status.HasValue) predicate = predicate.And(t => t.Status == query.Status.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(t => t.FireUnitId == query.FireUnitId.Value);
        if (query.InspectorId.HasValue) predicate = predicate.And(t => t.InspectorId == query.InspectorId.Value);
        if (query.StartDate.HasValue) predicate = predicate.And(t => t.PlanStartDate >= query.StartDate.Value);
        if (query.EndDate.HasValue) predicate = predicate.And(t => t.PlanEndDate <= query.EndDate.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(t => t.TaskName != null && t.TaskName.Contains(query.Keyword));

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode)).Select(u => u.Id).ToList();
            if (unitIds.Any()) predicate = predicate.And(t => unitIds.Contains(t.FireUnitId));
            else return ApiResponse<PagedResult<InspectionTaskDto>>.Success(new PagedResult<InspectionTaskDto> { PageIndex = query.PageIndex, PageSize = query.PageSize });
        }

        var result = await _unitOfWork.InspectionTasks.GetPagedAsync(predicate, query.PageIndex, query.PageSize, t => t.CreatedAt, query.IsDescending);
        var dtos = new List<InspectionTaskDto>();
        foreach (var t in result.Items) dtos.Add(await MapTaskToDtoAsync(t));

        return ApiResponse<PagedResult<InspectionTaskDto>>.Success(new PagedResult<InspectionTaskDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<InspectionTaskDto>> CreateTaskAsync(InspectionTaskCreateDto dto)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(dto.FireUnitId);
        if (unit == null || unit.IsDeleted) return ApiResponse<InspectionTaskDto>.Error(404, "单位不存在");

        var task = new InspectionTask
        {
            TaskNo = GenerateTaskNo(),
            FireUnitId = dto.FireUnitId,
            TaskName = dto.TaskName,
            DeviceType = dto.DeviceType,
            Status = InspectionStatus.Pending,
            PlanStartDate = dto.PlanStartDate,
            PlanEndDate = dto.PlanEndDate,
            InspectorId = dto.InspectorId,
            CycleDays = dto.CycleDays,
            Description = dto.Description,
            IsRecurring = dto.IsRecurring,
            RecurringRule = dto.RecurringRule
        };

        if (dto.InspectorId.HasValue)
        {
            var inspector = await _unitOfWork.Users.GetByIdAsync(dto.InspectorId.Value);
            task.InspectorName = inspector?.RealName;
        }

        await _unitOfWork.InspectionTasks.AddAsync(task);
        await _unitOfWork.SaveChangesAsync();

        return ApiResponse<InspectionTaskDto>.Success("创建成功", await MapTaskToDtoAsync(task));
    }

    public async Task<ApiResponse<bool>> UpdateTaskAsync(long id, InspectionTaskCreateDto dto)
    {
        var task = await _unitOfWork.InspectionTasks.GetByIdAsync(id);
        if (task == null || task.IsDeleted) return ApiResponse<bool>.Error(404, "巡检任务不存在");

        task.TaskName = dto.TaskName;
        task.DeviceType = dto.DeviceType;
        task.PlanStartDate = dto.PlanStartDate;
        task.PlanEndDate = dto.PlanEndDate;
        task.InspectorId = dto.InspectorId;
        task.CycleDays = dto.CycleDays;
        task.Description = dto.Description;
        task.IsRecurring = dto.IsRecurring;
        task.RecurringRule = dto.RecurringRule;

        if (dto.InspectorId.HasValue)
        {
            var inspector = await _unitOfWork.Users.GetByIdAsync(dto.InspectorId.Value);
            task.InspectorName = inspector?.RealName;
        }

        _unitOfWork.InspectionTasks.Update(task);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<bool>> DeleteTaskAsync(long id)
    {
        var task = await _unitOfWork.InspectionTasks.GetByIdAsync(id);
        if (task == null || task.IsDeleted) return ApiResponse<bool>.Error(404, "巡检任务不存在");
        task.IsDeleted = true;
        _unitOfWork.InspectionTasks.Update(task);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("删除成功", true);
    }

    public async Task<ApiResponse<InspectionRecordDto>> CreateRecordAsync(InspectionRecordCreateDto dto)
    {
        var task = await _unitOfWork.InspectionTasks.GetByIdAsync(dto.InspectionTaskId);
        if (task == null || task.IsDeleted) return ApiResponse<InspectionRecordDto>.Error(404, "巡检任务不存在");

        var inspector = await _unitOfWork.Users.GetByIdAsync(dto.InspectorId);

        var record = new InspectionRecord
        {
            InspectionTaskId = dto.InspectionTaskId,
            DeviceId = dto.DeviceId,
            DeviceCode = dto.DeviceId.HasValue ? (await _unitOfWork.Devices.GetByIdAsync(dto.DeviceId.Value))?.DeviceCode : null,
            Location = dto.Location,
            CheckInTime = DateTime.Now,
            CheckInLatitude = dto.CheckInLatitude,
            CheckInLongitude = dto.CheckInLongitude,
            QrCode = dto.QrCode,
            CheckItems = dto.CheckItems,
            CheckResult = dto.CheckResult,
            IsNormal = dto.IsNormal,
            Remark = dto.Remark,
            Photos = dto.Photos,
            InspectorId = dto.InspectorId,
            InspectorName = inspector?.RealName
        };

        await _unitOfWork.InspectionRecords.AddAsync(record);

        if (task.Status == InspectionStatus.Pending)
        {
            task.Status = InspectionStatus.InProgress;
            task.ActualStartDate = record.CheckInTime;
            _unitOfWork.InspectionTasks.Update(task);
        }

        await _unitOfWork.SaveChangesAsync();

        var recordDto = new InspectionRecordDto
        {
            Id = record.Id,
            InspectionTaskId = record.InspectionTaskId,
            DeviceId = record.DeviceId,
            DeviceCode = record.DeviceCode,
            Location = record.Location,
            CheckInTime = record.CheckInTime,
            QrCode = record.QrCode,
            CheckResult = record.CheckResult,
            IsNormal = record.IsNormal,
            Remark = record.Remark,
            Photos = record.Photos,
            InspectorId = record.InspectorId,
            InspectorName = record.InspectorName
        };

        return ApiResponse<InspectionRecordDto>.Success("签到成功", recordDto);
    }

    public async Task<ApiResponse<List<InspectionRecordDto>>> GetRecordsByTaskAsync(long taskId)
    {
        var records = await _unitOfWork.InspectionRecords.FindAsync(r => r.InspectionTaskId == taskId);
        var dtos = records.OrderByDescending(r => r.CheckInTime).Select(r => new InspectionRecordDto
        {
            Id = r.Id,
            InspectionTaskId = r.InspectionTaskId,
            DeviceId = r.DeviceId,
            DeviceCode = r.DeviceCode,
            Location = r.Location,
            CheckInTime = r.CheckInTime,
            QrCode = r.QrCode,
            CheckResult = r.CheckResult,
            IsNormal = r.IsNormal,
            Remark = r.Remark,
            Photos = r.Photos,
            InspectorId = r.InspectorId,
            InspectorName = r.InspectorName
        }).ToList();
        return ApiResponse<List<InspectionRecordDto>>.Success(dtos);
    }

    public async Task<ApiResponse<HazardRecordDto>> GetHazardByIdAsync(long id)
    {
        var hazard = await _unitOfWork.HazardRecords.GetByIdAsync(id);
        if (hazard == null || hazard.IsDeleted) return ApiResponse<HazardRecordDto>.Error(404, "隐患不存在");
        return ApiResponse<HazardRecordDto>.Success(await MapHazardToDtoAsync(hazard));
    }

    public async Task<ApiResponse<PagedResult<HazardRecordDto>>> GetHazardsPagedAsync(HazardQueryDto query)
    {
        var predicate = PredicateBuilder.True<HazardRecord>().And(h => !h.IsDeleted);
        if (query.Level.HasValue) predicate = predicate.And(h => h.Level == query.Level.Value);
        if (query.Status.HasValue) predicate = predicate.And(h => h.Status == query.Status.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(h => h.FireUnitId == query.FireUnitId.Value);
        if (query.IsOverdue.HasValue) predicate = predicate.And(h => h.IsOverdue == query.IsOverdue.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(h => h.Title.Contains(query.Keyword) || h.Description.Contains(query.Keyword));

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode)).Select(u => u.Id).ToList();
            if (unitIds.Any()) predicate = predicate.And(h => unitIds.Contains(h.FireUnitId));
        }

        var result = await _unitOfWork.HazardRecords.GetPagedAsync(predicate, query.PageIndex, query.PageSize, h => h.CreatedAt, query.IsDescending);
        var dtos = new List<HazardRecordDto>();
        foreach (var h in result.Items) dtos.Add(await MapHazardToDtoAsync(h));

        return ApiResponse<PagedResult<HazardRecordDto>>.Success(new PagedResult<HazardRecordDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<HazardRecordDto>> CreateHazardAsync(HazardRecordCreateDto dto)
    {
        var discoverer = await _unitOfWork.Users.GetByIdAsync(dto.DiscovererId);
        var rectifier = dto.RectifierId.HasValue ? await _unitOfWork.Users.GetByIdAsync(dto.RectifierId.Value) : null;

        var hazard = new HazardRecord
        {
            HazardNo = GenerateHazardNo(),
            FireUnitId = dto.FireUnitId,
            InspectionTaskId = dto.InspectionTaskId,
            Level = dto.Level,
            Status = HazardStatus.Registered,
            Title = dto.Title,
            Description = dto.Description,
            Location = dto.Location,
            Photos = dto.Photos,
            DiscoverTime = DateTime.Now,
            Deadline = dto.Deadline,
            DiscovererId = dto.DiscovererId,
            DiscovererName = discoverer?.RealName,
            RectifierId = dto.RectifierId,
            RectifierName = rectifier?.RealName,
            RectifyPlan = dto.RectifyPlan
        };

        await _unitOfWork.HazardRecords.AddAsync(hazard);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<HazardRecordDto>.Success("登记成功", await MapHazardToDtoAsync(hazard));
    }

    public async Task<ApiResponse<bool>> RectifyHazardAsync(HazardRectifyDto dto)
    {
        var hazard = await _unitOfWork.HazardRecords.GetByIdAsync(dto.HazardId);
        if (hazard == null || hazard.IsDeleted) return ApiResponse<bool>.Error(404, "隐患不存在");
        if (hazard.Status is not (HazardStatus.Registered or HazardStatus.Rectifying))
            return ApiResponse<bool>.Error(400, "隐患状态不允许整改");

        var rectifier = await _unitOfWork.Users.GetByIdAsync(dto.RectifierId);

        hazard.Status = HazardStatus.Rectified;
        hazard.RectifyTime = DateTime.Now;
        hazard.RectifyResult = dto.RectifyResult;
        hazard.Photos = !string.IsNullOrEmpty(dto.Photos) ? dto.Photos : hazard.Photos;
        hazard.RectifierId = dto.RectifierId;
        hazard.RectifierName = rectifier?.RealName ?? hazard.RectifierName;

        _unitOfWork.HazardRecords.Update(hazard);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("整改完成", true);
    }

    public async Task<ApiResponse<bool>> AcceptHazardAsync(HazardAcceptDto dto)
    {
        var hazard = await _unitOfWork.HazardRecords.GetByIdAsync(dto.HazardId);
        if (hazard == null || hazard.IsDeleted) return ApiResponse<bool>.Error(404, "隐患不存在");
        if (hazard.Status != HazardStatus.Rectified)
            return ApiResponse<bool>.Error(400, "隐患状态不允许验收");

        var acceptor = await _unitOfWork.Users.GetByIdAsync(dto.AcceptorId);

        hazard.Status = dto.IsAccepted ? HazardStatus.Accepted : HazardStatus.Rectifying;
        hazard.AcceptTime = DateTime.Now;
        hazard.AcceptRemark = dto.AcceptRemark;
        hazard.AcceptorId = dto.AcceptorId;
        hazard.AcceptorName = acceptor?.RealName;

        _unitOfWork.HazardRecords.Update(hazard);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success(dto.IsAccepted ? "验收通过" : "需重新整改", true);
    }

    public async Task<ApiResponse<bool>> EscalateOverdueHazardsAsync()
    {
        var now = DateTime.Now;
        var overdue = await _unitOfWork.HazardRecords.FindAsync(h =>
            !h.IsDeleted && h.Status != HazardStatus.Accepted && h.Deadline < now);

        foreach (var hazard in overdue)
        {
            hazard.IsOverdue = true;
            if (hazard.EscalationLevel < 3)
            {
                hazard.EscalationLevel++;
                hazard.Status = hazard.Status == HazardStatus.Registered ? HazardStatus.Rectifying : hazard.Status;
            }
            _unitOfWork.HazardRecords.Update(hazard);
        }

        await _unitOfWork.SaveChangesAsync();
        _logger.LogInformation($"超期隐患升级处理完成，共{overdue.Count()}条");
        return ApiResponse<bool>.Success(true);
    }

    public async Task<ApiResponse<InspectionStatisticsDto>> GetStatisticsAsync(long? fireUnitId = null, string? districtCode = null)
    {
        var taskPredicate = PredicateBuilder.True<InspectionTask>().And(t => !t.IsDeleted);
        var hazardPredicate = PredicateBuilder.True<HazardRecord>().And(h => !h.IsDeleted);

        if (fireUnitId.HasValue)
        {
            taskPredicate = taskPredicate.And(t => t.FireUnitId == fireUnitId.Value);
            hazardPredicate = hazardPredicate.And(h => h.FireUnitId == fireUnitId.Value);
        }

        if (!string.IsNullOrEmpty(districtCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == districtCode)).Select(u => u.Id).ToList();
            if (unitIds.Any())
            {
                taskPredicate = taskPredicate.And(t => unitIds.Contains(t.FireUnitId));
                hazardPredicate = hazardPredicate.And(h => unitIds.Contains(h.FireUnitId));
            }
        }

        var tasks = await _unitOfWork.InspectionTasks.FindAsync(taskPredicate);
        var hazards = await _unitOfWork.HazardRecords.FindAsync(hazardPredicate);

        var now = DateTime.Now;
        var stats = new InspectionStatisticsDto
        {
            TotalTaskCount = tasks.Count(),
            CompletedTaskCount = tasks.Count(t => t.Status == InspectionStatus.Completed),
            OverdueTaskCount = tasks.Count(t => t.Status != InspectionStatus.Completed && t.PlanEndDate < now),
            TotalHazardCount = hazards.Count(),
            PendingHazardCount = hazards.Count(h => h.Status is HazardStatus.Registered or HazardStatus.Rectifying),
            ResolvedHazardCount = hazards.Count(h => h.Status == HazardStatus.Accepted),
            OverdueHazardCount = hazards.Count(h => h.IsOverdue)
        };
        stats.CompletionRate = stats.TotalTaskCount > 0 ? Math.Round((double)stats.CompletedTaskCount / stats.TotalTaskCount * 100, 2) : 0;

        return ApiResponse<InspectionStatisticsDto>.Success(stats);
    }

    public async Task GenerateRecurringTasksAsync()
    {
        var recurringTasks = await _unitOfWork.InspectionTasks.FindAsync(t =>
            t.IsRecurring && !t.IsDeleted && t.CycleDays.HasValue && t.CycleDays > 0);

        var now = DateTime.Now;
        foreach (var task in recurringTasks)
        {
            var lastEnd = task.PlanEndDate;
            if (now >= lastEnd.AddDays(-1))
            {
                var newStart = lastEnd.AddDays(1);
                var duration = (task.PlanEndDate - task.PlanStartDate).Days;
                var newTask = new InspectionTask
                {
                    TaskNo = GenerateTaskNo(),
                    FireUnitId = task.FireUnitId,
                    TaskName = task.TaskName,
                    DeviceType = task.DeviceType,
                    Status = InspectionStatus.Pending,
                    PlanStartDate = newStart,
                    PlanEndDate = newStart.AddDays(duration),
                    InspectorId = task.InspectorId,
                    InspectorName = task.InspectorName,
                    CycleDays = task.CycleDays,
                    Description = task.Description,
                    IsRecurring = true,
                    RecurringRule = task.RecurringRule
                };
                await _unitOfWork.InspectionTasks.AddAsync(newTask);
                _logger.LogInformation($"生成周期巡检任务: {newTask.TaskNo}");
            }
        }
        await _unitOfWork.SaveChangesAsync();
    }

    private async Task<InspectionTaskDto> MapTaskToDtoAsync(InspectionTask task)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(task.FireUnitId);
        return new InspectionTaskDto
        {
            Id = task.Id,
            TaskNo = task.TaskNo,
            FireUnitId = task.FireUnitId,
            FireUnitName = unit?.Name,
            TaskName = task.TaskName,
            DeviceType = task.DeviceType,
            Status = task.Status,
            StatusName = GetTaskStatusName(task.Status),
            PlanStartDate = task.PlanStartDate,
            PlanEndDate = task.PlanEndDate,
            ActualStartDate = task.ActualStartDate,
            ActualEndDate = task.ActualEndDate,
            InspectorId = task.InspectorId,
            InspectorName = task.InspectorName,
            CycleDays = task.CycleDays,
            Description = task.Description,
            CreatedAt = task.CreatedAt
        };
    }

    private async Task<HazardRecordDto> MapHazardToDtoAsync(HazardRecord hazard)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(hazard.FireUnitId);
        return new HazardRecordDto
        {
            Id = hazard.Id,
            HazardNo = hazard.HazardNo,
            FireUnitId = hazard.FireUnitId,
            FireUnitName = unit?.Name,
            InspectionTaskId = hazard.InspectionTaskId,
            Level = hazard.Level,
            LevelName = GetHazardLevelName(hazard.Level),
            Status = hazard.Status,
            StatusName = GetHazardStatusName(hazard.Status),
            Title = hazard.Title,
            Description = hazard.Description,
            Location = hazard.Location,
            Photos = hazard.Photos,
            DiscoverTime = hazard.DiscoverTime,
            Deadline = hazard.Deadline,
            RectifyTime = hazard.RectifyTime,
            AcceptTime = hazard.AcceptTime,
            DiscovererName = hazard.DiscovererName,
            RectifierName = hazard.RectifierName,
            RectifyPlan = hazard.RectifyPlan,
            RectifyResult = hazard.RectifyResult,
            EscalationLevel = hazard.EscalationLevel,
            IsOverdue = hazard.IsOverdue
        };
    }

    private static string GetTaskStatusName(InspectionStatus s) => s switch
    {
        InspectionStatus.Pending => "待执行",
        InspectionStatus.InProgress => "执行中",
        InspectionStatus.Completed => "已完成",
        InspectionStatus.Overdue => "已超期",
        _ => "未知"
    };

    private static string GetHazardLevelName(HazardLevel l) => l switch
    {
        HazardLevel.General => "一般隐患",
        HazardLevel.Major => "重大隐患",
        HazardLevel.Critical => "特别重大隐患",
        _ => "未知"
    };

    private static string GetHazardStatusName(HazardStatus s) => s switch
    {
        HazardStatus.Registered => "已登记",
        HazardStatus.Rectifying => "整改中",
        HazardStatus.Rectified => "已整改",
        HazardStatus.Accepted => "已验收",
        HazardStatus.Overdue => "已超期",
        _ => "未知"
    };

    private static string GenerateTaskNo() => $"INSP{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";
    private static string GenerateHazardNo() => $"HZD{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";
}
