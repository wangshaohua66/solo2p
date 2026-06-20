using Microsoft.EntityFrameworkCore;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.WorkOrder;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;
using FireIoTPlatform.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace FireIoTPlatform.Services;

public class WorkOrderService : IWorkOrderService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHubContext<FireAlarmHub> _hubContext;
    private readonly ILogger<WorkOrderService> _logger;

    public WorkOrderService(IUnitOfWork unitOfWork, IHubContext<FireAlarmHub> hubContext, ILogger<WorkOrderService> logger)
    {
        _unitOfWork = unitOfWork;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<ApiResponse<WorkOrderDto>> GetByIdAsync(long id)
    {
        var order = await _unitOfWork.WorkOrders.GetByIdAsync(id);
        if (order == null || order.IsDeleted)
            return ApiResponse<WorkOrderDto>.Error(404, "工单不存在");

        return ApiResponse<WorkOrderDto>.Success(await MapToDtoAsync(order));
    }

    public async Task<ApiResponse<PagedResult<WorkOrderDto>>> GetPagedAsync(WorkOrderQueryDto query)
    {
        var predicate = PredicateBuilder.True<WorkOrder>().And(w => !w.IsDeleted);

        if (query.Priority.HasValue) predicate = predicate.And(w => w.Priority == query.Priority.Value);
        if (query.Status.HasValue) predicate = predicate.And(w => w.Status == query.Status.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(w => w.FireUnitId == query.FireUnitId.Value);
        if (query.DeviceId.HasValue) predicate = predicate.And(w => w.DeviceId == query.DeviceId.Value);
        if (query.AlarmId.HasValue) predicate = predicate.And(w => w.AlarmId == query.AlarmId.Value);
        if (query.AssignedToId.HasValue) predicate = predicate.And(w => w.AssignedToId == query.AssignedToId.Value);
        if (query.IsOverdue.HasValue) predicate = predicate.And(w => w.IsOverdue == query.IsOverdue.Value);
        if (!string.IsNullOrEmpty(query.SourceType)) predicate = predicate.And(w => w.SourceType == query.SourceType);
        if (query.StartTime.HasValue) predicate = predicate.And(w => w.CreatedAt >= query.StartTime.Value);
        if (query.EndTime.HasValue) predicate = predicate.And(w => w.CreatedAt <= query.EndTime.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(w => w.OrderNo.Contains(query.Keyword) || w.Title.Contains(query.Keyword));

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = (await _unitOfWork.FireUnits
                .FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode))
                .Select(u => u.Id).ToList();
            if (unitIds.Any())
                predicate = predicate.And(w => unitIds.Contains(w.FireUnitId));
            else
                return ApiResponse<PagedResult<WorkOrderDto>>.Success(new PagedResult<WorkOrderDto>
                { PageIndex = query.PageIndex, PageSize = query.PageSize });
        }

        var result = await _unitOfWork.WorkOrders.GetPagedAsync(predicate, query.PageIndex, query.PageSize,
            w => w.CreatedAt, query.IsDescending);

        var dtos = new List<WorkOrderDto>();
        foreach (var order in result.Items) dtos.Add(await MapToDtoAsync(order));

        return ApiResponse<PagedResult<WorkOrderDto>>.Success(new PagedResult<WorkOrderDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageIndex = query.PageIndex,
            PageSize = query.PageSize
        });
    }

    public async Task<ApiResponse<WorkOrderDto>> CreateAsync(WorkOrderCreateDto dto)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(dto.FireUnitId);
        if (unit == null || unit.IsDeleted)
            return ApiResponse<WorkOrderDto>.Error(404, "单位不存在");

        var order = new WorkOrder
        {
            OrderNo = GenerateOrderNo(),
            SourceType = dto.SourceType,
            SourceId = dto.SourceId,
            FireUnitId = dto.FireUnitId,
            DeviceId = dto.DeviceId,
            AlarmId = dto.AlarmId,
            Title = dto.Title,
            Description = dto.Description,
            Priority = dto.Priority,
            Status = HazardStatus.Registered,
            AssignedTo = dto.AssignedTo,
            AssignedToId = dto.AssignedToId,
            AssignedAt = dto.AssignedToId.HasValue ? DateTime.Now : null,
            Deadline = dto.Deadline,
            Photos = dto.Photos,
            Remark = dto.Remark
        };

        await _unitOfWork.WorkOrders.AddAsync(order);
        await _unitOfWork.SaveChangesAsync();

        var dtoResult = await MapToDtoAsync(order);
        await _hubContext.Clients.Group($"unit_{dto.FireUnitId}").SendAsync("NewWorkOrder", dtoResult);
        _logger.LogInformation($"工单创建成功: OrderNo={order.OrderNo}, Type={dto.SourceType}");

        return ApiResponse<WorkOrderDto>.Success("创建成功", dtoResult);
    }

    public async Task<ApiResponse<bool>> UpdateAsync(long id, WorkOrderUpdateDto dto)
    {
        var order = await _unitOfWork.WorkOrders.GetByIdAsync(id);
        if (order == null || order.IsDeleted)
            return ApiResponse<bool>.Error(404, "工单不存在");

        if (!string.IsNullOrEmpty(dto.Title)) order.Title = dto.Title;
        if (!string.IsNullOrEmpty(dto.Description)) order.Description = dto.Description;
        if (dto.Priority.HasValue) order.Priority = dto.Priority.Value;
        if (!string.IsNullOrEmpty(dto.AssignedTo)) order.AssignedTo = dto.AssignedTo;
        if (dto.AssignedToId.HasValue)
        {
            order.AssignedToId = dto.AssignedToId.Value;
            order.AssignedAt = DateTime.Now;
        }
        if (dto.Deadline.HasValue) order.Deadline = dto.Deadline.Value;
        if (!string.IsNullOrEmpty(dto.Remark)) order.Remark = dto.Remark;

        _unitOfWork.WorkOrders.Update(order);
        await _unitOfWork.SaveChangesAsync();

        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<bool>> DeleteAsync(long id)
    {
        var order = await _unitOfWork.WorkOrders.GetByIdAsync(id);
        if (order == null || order.IsDeleted)
            return ApiResponse<bool>.Error(404, "工单不存在");

        order.IsDeleted = true;
        _unitOfWork.WorkOrders.Update(order);
        await _unitOfWork.SaveChangesAsync();

        return ApiResponse<bool>.Success("删除成功", true);
    }

    public async Task<ApiResponse<bool>> AssignAsync(WorkOrderAssignDto dto)
    {
        var order = await _unitOfWork.WorkOrders.GetByIdAsync(dto.WorkOrderId);
        if (order == null || order.IsDeleted)
            return ApiResponse<bool>.Error(404, "工单不存在");
        if (order.Status == HazardStatus.Accepted)
            return ApiResponse<bool>.Error(400, "已完成的工单不能重新派单");

        order.AssignedTo = dto.AssignedTo;
        order.AssignedToId = dto.AssignedToId;
        order.AssignedAt = DateTime.Now;
        order.Status = HazardStatus.Rectifying;

        _unitOfWork.WorkOrders.Update(order);
        await _unitOfWork.SaveChangesAsync();

        var orderDto = await MapToDtoAsync(order);
        await _hubContext.Clients.Group($"unit_{order.FireUnitId}").SendAsync("WorkOrderUpdated", orderDto);
        _logger.LogInformation($"工单派单: OrderNo={order.OrderNo}, AssignedTo={dto.AssignedTo}");

        return ApiResponse<bool>.Success("派单成功", true);
    }

    public async Task<ApiResponse<bool>> StartAsync(WorkOrderStartDto dto)
    {
        var order = await _unitOfWork.WorkOrders.GetByIdAsync(dto.WorkOrderId);
        if (order == null || order.IsDeleted)
            return ApiResponse<bool>.Error(404, "工单不存在");
        if (order.Status is not (HazardStatus.Registered or HazardStatus.Rectifying))
            return ApiResponse<bool>.Error(400, "工单状态不允许开始处理");

        order.Status = HazardStatus.Rectifying;
        order.StartedAt = DateTime.Now;
        if (!string.IsNullOrEmpty(dto.Remark))
            order.Remark = dto.Remark;

        _unitOfWork.WorkOrders.Update(order);
        await _unitOfWork.SaveChangesAsync();

        var orderDto = await MapToDtoAsync(order);
        await _hubContext.Clients.Group($"unit_{order.FireUnitId}").SendAsync("WorkOrderUpdated", orderDto);

        return ApiResponse<bool>.Success("开始处理", true);
    }

    public async Task<ApiResponse<bool>> CompleteAsync(WorkOrderCompleteDto dto)
    {
        var order = await _unitOfWork.WorkOrders.GetByIdAsync(dto.WorkOrderId);
        if (order == null || order.IsDeleted)
            return ApiResponse<bool>.Error(404, "工单不存在");
        if (order.Status is not (HazardStatus.Rectifying or HazardStatus.Registered))
            return ApiResponse<bool>.Error(400, "工单状态不允许完成");

        order.Status = HazardStatus.Accepted;
        order.CompletedAt = DateTime.Now;
        order.Resolution = dto.Resolution;
        if (!string.IsNullOrEmpty(dto.Photos))
            order.Photos = dto.Photos;

        _unitOfWork.WorkOrders.Update(order);
        await _unitOfWork.SaveChangesAsync();

        var orderDto = await MapToDtoAsync(order);
        await _hubContext.Clients.Group($"unit_{order.FireUnitId}").SendAsync("WorkOrderUpdated", orderDto);
        _logger.LogInformation($"工单完成: OrderNo={order.OrderNo}");

        return ApiResponse<bool>.Success("完成成功", true);
    }

    public async Task<ApiResponse<bool>> EscalateAsync(long workOrderId, string? reason = null)
    {
        var order = await _unitOfWork.WorkOrders.GetByIdAsync(workOrderId);
        if (order == null || order.IsDeleted)
            return ApiResponse<bool>.Error(404, "工单不存在");
        if (order.EscalationLevel >= 3)
            return ApiResponse<bool>.Error(400, "工单已达到最高升级级别");

        order.EscalationLevel++;
        order.Priority = order.Priority switch
        {
            HazardLevel.General => HazardLevel.Major,
            HazardLevel.Major => HazardLevel.Critical,
            _ => HazardLevel.Critical
        };

        if (!string.IsNullOrEmpty(reason))
            order.Remark = (order.Remark ?? "") + "\n升级原因: " + reason;

        _unitOfWork.WorkOrders.Update(order);
        await _unitOfWork.SaveChangesAsync();

        var orderDto = await MapToDtoAsync(order);
        await _hubContext.Clients.All.SendAsync("WorkOrderEscalated", orderDto);
        _logger.LogWarning($"工单升级: OrderNo={order.OrderNo}, Level={order.EscalationLevel}, Priority={order.Priority}");

        return ApiResponse<bool>.Success("升级成功", true);
    }

    public async Task<ApiResponse<WorkOrderStatisticsDto>> GetStatisticsAsync(long? fireUnitId = null, string? districtCode = null)
    {
        var predicate = PredicateBuilder.True<WorkOrder>().And(w => !w.IsDeleted);

        if (fireUnitId.HasValue)
            predicate = predicate.And(w => w.FireUnitId == fireUnitId.Value);

        if (!string.IsNullOrEmpty(districtCode))
        {
            var unitIds = (await _unitOfWork.FireUnits
                .FindAsync(u => !u.IsDeleted && u.DistrictCode == districtCode))
                .Select(u => u.Id).ToList();
            if (unitIds.Any())
                predicate = predicate.And(w => unitIds.Contains(w.FireUnitId));
        }

        var orders = await _unitOfWork.WorkOrders.FindAsync(predicate);
        var completed = orders.Where(o => o.Status == HazardStatus.Accepted && o.StartedAt.HasValue && o.CompletedAt.HasValue).ToList();

        var stats = new WorkOrderStatisticsDto
        {
            TotalCount = orders.Count(),
            RegisteredCount = orders.Count(o => o.Status == HazardStatus.Registered),
            ProcessingCount = orders.Count(o => o.Status == HazardStatus.Rectifying),
            CompletedCount = orders.Count(o => o.Status == HazardStatus.Accepted),
            OverdueCount = orders.Count(o => o.IsOverdue),
            CompletionRate = orders.Any()
                ? Math.Round((double)orders.Count(o => o.Status == HazardStatus.Accepted) / orders.Count() * 100, 2)
                : 0
        };

        if (completed.Any())
        {
            stats.AverageCompletionHours = Math.Round(
                completed.Average(o => (o.CompletedAt!.Value - o.StartedAt!.Value).TotalHours), 2);
        }

        return ApiResponse<WorkOrderStatisticsDto>.Success(stats);
    }

    public async Task<ApiResponse<bool>> CheckOverdueOrdersAsync()
    {
        var now = DateTime.Now;
        var overdue = await _unitOfWork.WorkOrders.FindAsync(w =>
            !w.IsDeleted && w.Status != HazardStatus.Accepted && w.Deadline < now);

        foreach (var order in overdue)
        {
            if (!order.IsOverdue)
            {
                order.IsOverdue = true;
                _unitOfWork.WorkOrders.Update(order);

                var orderDto = await MapToDtoAsync(order);
                await _hubContext.Clients.Group($"unit_{order.FireUnitId}").SendAsync("WorkOrderOverdue", orderDto);
                _logger.LogWarning($"工单超期: OrderNo={order.OrderNo}, Deadline={order.Deadline}");
            }

            if (order.EscalationLevel < 3 && (now - order.Deadline).TotalDays >= order.EscalationLevel + 1)
            {
                await EscalateAsync(order.Id, "超期未处理自动升级");
            }
        }

        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success(true);
    }

    public async Task CreateMaintenanceWorkOrderFromAlarmAsync(long alarmId)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(alarmId);
        if (alarm == null || alarm.IsDeleted)
        {
            _logger.LogWarning($"告警不存在，无法生成维修工单: AlarmId={alarmId}");
            return;
        }

        var existing = await _unitOfWork.WorkOrders.FirstOrDefaultAsync(w =>
            w.AlarmId == alarmId && !w.IsDeleted && w.Status != HazardStatus.Accepted);

        if (existing != null)
        {
            _logger.LogInformation($"该告警已有未完成工单: AlarmId={alarmId}, OrderNo={existing.OrderNo}");
            return;
        }

        var device = alarm.DeviceId.HasValue ? await _unitOfWork.Devices.GetByIdAsync(alarm.DeviceId.Value) : null;
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(alarm.FireUnitId);

        var maintenanceContract = unit != null
            ? (await _unitOfWork.MaintenanceContracts
                .FindAsync(c => c.FireUnitId == alarm.FireUnitId && c.Status == MaintenanceStatus.Active))
                .FirstOrDefault()
            : null;

        var deadline = alarm.AlarmLevel switch
        {
            AlarmLevel.Emergency => DateTime.Now.AddHours(2),
            AlarmLevel.Critical => DateTime.Now.AddHours(8),
            AlarmLevel.Warning => DateTime.Now.AddDays(1),
            _ => DateTime.Now.AddDays(3)
        };

        var priority = alarm.AlarmLevel switch
        {
            AlarmLevel.Emergency => HazardLevel.Critical,
            AlarmLevel.Critical => HazardLevel.Major,
            _ => HazardLevel.General
        };

        var order = new WorkOrder
        {
            OrderNo = GenerateOrderNo(),
            SourceType = "Alarm",
            SourceId = alarmId,
            FireUnitId = alarm.FireUnitId,
            DeviceId = alarm.DeviceId,
            AlarmId = alarmId,
            Title = $"{GetAlarmTypeName(alarm.AlarmType)}维修工单",
            Description = $"{alarm.Description}\n告警编号: {alarm.AlarmNo}\n" +
                          $"告警类型: {GetAlarmTypeName(alarm.AlarmType)}\n" +
                          $"告警级别: {GetAlarmLevelName(alarm.AlarmLevel)}\n" +
                          $"告警时间: {alarm.AlarmTime:yyyy-MM-dd HH:mm:ss}\n" +
                          $"告警位置: {alarm.Location} {alarm.Floor} {alarm.Room}\n" +
                          (alarm.AlarmValue.HasValue ? $"告警数值: {alarm.AlarmValue}\n" : "") +
                          (alarm.ThresholdValue.HasValue ? $"阈值: {alarm.ThresholdValue}\n" : ""),
            Priority = priority,
            Status = HazardStatus.Registered,
            AssignedTo = maintenanceContract?.ContactPerson,
            AssignedToId = null,
            AssignedAt = maintenanceContract != null ? DateTime.Now : null,
            Deadline = deadline
        };

        if (maintenanceContract != null && order.Status != HazardStatus.Registered)
        {
            order.Status = HazardStatus.Rectifying;
        }

        await _unitOfWork.WorkOrders.AddAsync(order);
        await _unitOfWork.SaveChangesAsync();

        var dto = await MapToDtoAsync(order);
        await _hubContext.Clients.Group($"unit_{alarm.FireUnitId}").SendAsync("NewWorkOrder", dto);
        _logger.LogInformation($"告警自动生成维修工单: AlarmId={alarmId}, OrderNo={order.OrderNo}, Deadline={deadline:yyyy-MM-dd HH:mm}");
    }

    private async Task<WorkOrderDto> MapToDtoAsync(WorkOrder order)
    {
        var unit = order.FireUnitId > 0 ? await _unitOfWork.FireUnits.GetByIdAsync(order.FireUnitId) : null;
        var device = order.DeviceId.HasValue ? await _unitOfWork.Devices.GetByIdAsync(order.DeviceId.Value) : null;
        var alarm = order.AlarmId.HasValue ? await _unitOfWork.AlarmRecords.GetByIdAsync(order.AlarmId.Value) : null;

        return new WorkOrderDto
        {
            Id = order.Id,
            OrderNo = order.OrderNo,
            SourceType = order.SourceType,
            SourceId = order.SourceId,
            FireUnitId = order.FireUnitId,
            FireUnitName = unit?.Name,
            DeviceId = order.DeviceId,
            DeviceCode = device?.DeviceCode,
            DeviceName = device?.DeviceName,
            AlarmId = order.AlarmId,
            AlarmNo = alarm?.AlarmNo,
            Title = order.Title,
            Description = order.Description,
            Priority = order.Priority,
            PriorityName = GetPriorityName(order.Priority),
            Status = order.Status,
            StatusName = GetStatusName(order.Status),
            AssignedTo = order.AssignedTo,
            AssignedToId = order.AssignedToId,
            AssignedAt = order.AssignedAt,
            Deadline = order.Deadline,
            StartedAt = order.StartedAt,
            CompletedAt = order.CompletedAt,
            Resolution = order.Resolution,
            Photos = order.Photos,
            Remark = order.Remark,
            IsOverdue = order.IsOverdue,
            EscalationLevel = order.EscalationLevel,
            CreatedAt = order.CreatedAt
        };
    }

    private static string GenerateOrderNo() => $"WO{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";

    private static string GetPriorityName(HazardLevel level) => level switch
    {
        HazardLevel.General => "一般",
        HazardLevel.Major => "重大",
        HazardLevel.Critical => "特别重大",
        _ => "未知"
    };

    private static string GetStatusName(HazardStatus status) => status switch
    {
        HazardStatus.Registered => "待派单",
        HazardStatus.Rectifying => "处理中",
        HazardStatus.Rectified => "待验收",
        HazardStatus.Accepted => "已完成",
        HazardStatus.Overdue => "已超期",
        _ => "未知"
    };

    private static string GetAlarmTypeName(AlarmType type) => type switch
    {
        AlarmType.SmokeAlarm => "烟雾报警",
        AlarmType.TemperatureAlarm => "温度报警",
        AlarmType.WaterPressureLow => "水压过低",
        AlarmType.WaterLevelLow => "水位过低",
        AlarmType.DeviceOffline => "设备离线",
        AlarmType.DeviceFault => "设备故障",
        AlarmType.ElectricalFire => "电气火灾",
        AlarmType.HydrantAbnormal => "消防栓异常",
        _ => "未知告警"
    };

    private static string GetAlarmLevelName(AlarmLevel level) => level switch
    {
        AlarmLevel.Info => "提示",
        AlarmLevel.Warning => "警告",
        AlarmLevel.Critical => "严重",
        AlarmLevel.Emergency => "紧急",
        _ => "未知"
    };
}
