using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HazChemSupervision.Services;

public class AlertService : IAlertService
{
    private readonly IBaseRepository<Alert> _alertRepo;
    private readonly IBaseRepository<Inventory> _inventoryRepo;
    private readonly IBaseRepository<TransportRecord> _transportRepo;
    private readonly IBaseRepository<HazardRectification> _hazardRepo;
    private readonly IBaseRepository<EmergencyDrill> _drillRepo;
    private readonly IBaseRepository<Certificate> _certRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IConfiguration _config;
    private readonly IMapper _mapper;

    public AlertService(
        IBaseRepository<Alert> alertRepo,
        IBaseRepository<Inventory> inventoryRepo,
        IBaseRepository<TransportRecord> transportRepo,
        IBaseRepository<HazardRectification> hazardRepo,
        IBaseRepository<EmergencyDrill> drillRepo,
        IBaseRepository<Certificate> certRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IConfiguration config,
        IMapper mapper)
    {
        _alertRepo = alertRepo;
        _inventoryRepo = inventoryRepo;
        _transportRepo = transportRepo;
        _hazardRepo = hazardRepo;
        _drillRepo = drillRepo;
        _certRepo = certRepo;
        _enterpriseRepo = enterpriseRepo;
        _config = config;
        _mapper = mapper;
    }

    public async Task<AlertDto> CreateAlertAsync(AlertCreateDto dto)
    {
        var alert = _mapper.Map<Alert>(dto);
        alert.AlertNo = $"ALERT-{DateTime.UtcNow:yyyyMMddHHmmss}-{new Random().Next(1000, 9999)}";
        alert.Status = AlertStatus.New;
        alert.CreatedAt = DateTime.UtcNow;
        alert.UpdatedAt = DateTime.UtcNow;

        var result = await _alertRepo.AddAsync(alert);
        return _mapper.Map<AlertDto>(result);
    }

    public async Task<List<AlertDto>> CreateBatchAlertsAsync(List<AlertCreateDto> dtos)
    {
        var alerts = new List<Alert>();
        foreach (var dto in dtos)
        {
            var alert = _mapper.Map<Alert>(dto);
            alert.AlertNo = $"ALERT-{DateTime.UtcNow:yyyyMMddHHmmss}-{new Random().Next(1000, 9999)}";
            alert.Status = AlertStatus.New;
            alert.CreatedAt = DateTime.UtcNow;
            alert.UpdatedAt = DateTime.UtcNow;
            alerts.Add(alert);
        }

        var result = await _alertRepo.AddRangeAsync(alerts);
        return _mapper.Map<List<AlertDto>>(result);
    }

    public async Task<AlertDto?> GetAlertByIdAsync(int id)
    {
        var alert = await _alertRepo.GetByIdAsync(id);
        return alert != null ? _mapper.Map<AlertDto>(alert) : null;
    }

    public async Task<PagedResult<AlertDto>> GetAlertsAsync(AlertQueryDto dto)
    {
        var predicate = PredicateBuilder.True<Alert>();

        if (dto.Type.HasValue)
            predicate = predicate.And(a => a.Type == (AlertType)dto.Type.Value);

        if (dto.Level.HasValue)
            predicate = predicate.And(a => a.Level == (AlertLevel)dto.Level.Value);

        if (dto.Status.HasValue)
            predicate = predicate.And(a => a.Status == (AlertStatus)dto.Status.Value);

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(a => a.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.IsRead.HasValue)
            predicate = predicate.And(a => a.IsRead == dto.IsRead.Value);

        if (dto.IsHandled.HasValue)
            predicate = predicate.And(a => a.IsHandled == dto.IsHandled.Value);

        if (dto.CreatedDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(a => a.CreatedAt >= dto.CreatedDateRange.StartDate.Value);

        if (dto.CreatedDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(a => a.CreatedAt < dto.CreatedDateRange.EndDate.Value.AddDays(1));

        var result = await _alertRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(a => a.CreatedAt),
            dto.PageIndex,
            dto.PageSize);

        return _mapper.Map<PagedResult<AlertDto>>(result);
    }

    public async Task<bool> MarkAsReadAsync(int id)
    {
        var alert = await _alertRepo.GetByIdAsync(id);
        if (alert == null) return false;

        alert.IsRead = true;
        alert.ReadTime = DateTime.UtcNow;
        alert.UpdatedAt = DateTime.UtcNow;

        await _alertRepo.UpdateAsync(alert);
        return true;
    }

    public async Task<bool> MarkAsHandledAsync(int id, AlertHandleDto dto)
    {
        var alert = await _alertRepo.GetByIdAsync(id);
        if (alert == null) return false;

        alert.IsHandled = true;
        alert.HandleTime = dto.HandleTime;
        alert.HandleResult = dto.HandleResult;
        alert.HandlerUserId = dto.HandlerUserId;
        alert.Status = AlertStatus.Handled;
        alert.UpdatedAt = DateTime.UtcNow;

        await _alertRepo.UpdateAsync(alert);
        return true;
    }

    public async Task<int> GetUnreadCountAsync(int? userId = null, string? role = null)
    {
        var predicate = PredicateBuilder.True<Alert>()
            .And(a => !a.IsRead && a.Status != AlertStatus.Closed);

        if (userId.HasValue)
            predicate = predicate.And(a => a.RecipientUserId == userId.Value);

        if (!string.IsNullOrEmpty(role))
            predicate = predicate.And(a => a.RecipientRole == role);

        return await _alertRepo.CountAsync(predicate);
    }

    public async Task CheckAndGenerateInventoryAlertsAsync()
    {
        var nearExpiryDays = _config.GetValue<int>("Alert:NearExpiryDays", 30);
        var overstockThreshold = _config.GetValue<decimal>("Alert:InventoryOverstockThreshold", 0.9M);
        var lowStockThreshold = _config.GetValue<decimal>("Alert:InventoryLowStockThreshold", 0.1M);
        var now = DateTime.UtcNow;
        var expiryThreshold = now.AddDays(nearExpiryDays);

        var alertInventories = await _inventoryRepo.GetQueryable()
            .Include(i => i.Enterprise)
            .Include(i => i.Chemical)
            .Include(i => i.Warehouse)
            .Where(i =>
                (i.MaxCapacity > 0 && i.Quantity / i.MaxCapacity >= overstockThreshold && !i.HasOverstockAlert) ||
                (i.Quantity <= i.MinSafeQuantity && !i.HasLowStockAlert) ||
                (i.EarliestExpiryDate.HasValue && i.EarliestExpiryDate.Value <= expiryThreshold && !i.HasExpiryAlert) ||
                (i.MaxCapacity > 0 && i.Quantity / i.MaxCapacity < overstockThreshold && i.HasOverstockAlert) ||
                (i.Quantity > i.MinSafeQuantity && i.HasLowStockAlert) ||
                (i.EarliestExpiryDate.HasValue && i.EarliestExpiryDate.Value > expiryThreshold && i.HasExpiryAlert))
            .Take(5000)
            .ToListAsync();

        if (!alertInventories.Any())
            return;

        var alertDtos = new List<AlertCreateDto>();
        var inventoriesToUpdate = new List<Inventory>();

        foreach (var inventory in alertInventories)
        {
            var usageRate = inventory.MaxCapacity > 0 ? inventory.Quantity / inventory.MaxCapacity : 0;
            var changed = false;

            if (usageRate >= overstockThreshold && !inventory.HasOverstockAlert)
            {
                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.InventoryOverstock,
                    Level = (int)AlertLevel.Warning,
                    EnterpriseId = inventory.EnterpriseId,
                    ChemicalId = inventory.ChemicalId,
                    WarehouseId = inventory.WarehouseId,
                    Title = $"库存超限预警：{inventory.Chemical.Name}",
                    Content = $"{inventory.Enterprise.Name}的{inventory.Warehouse.Name}中{inventory.Chemical.Name}库存量已达库容的{usageRate * 100:F1}%，超过预警阈值{overstockThreshold * 100}%",
                    Suggestion = "请及时安排出库或调整库存计划，联系下游客户进行销售",
                    RecipientRole = "Enterprise"
                });

                inventory.HasOverstockAlert = true;
                inventory.Status = InventoryStatus.Overstock;
                changed = true;
            }
            else if (usageRate < overstockThreshold && inventory.HasOverstockAlert)
            {
                inventory.HasOverstockAlert = false;
                changed = true;
            }

            if (inventory.Quantity <= inventory.MinSafeQuantity && !inventory.HasLowStockAlert)
            {
                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.InventoryLowStock,
                    Level = (int)AlertLevel.Warning,
                    EnterpriseId = inventory.EnterpriseId,
                    ChemicalId = inventory.ChemicalId,
                    WarehouseId = inventory.WarehouseId,
                    Title = $"库存不足预警：{inventory.Chemical.Name}",
                    Content = $"{inventory.Enterprise.Name}的{inventory.Warehouse.Name}中{inventory.Chemical.Name}库存量已低于安全库存{inventory.MinSafeQuantity}{inventory.Unit}",
                    Suggestion = "请及时安排补货，避免影响生产",
                    RecipientRole = "Enterprise"
                });

                inventory.HasLowStockAlert = true;
                inventory.Status = InventoryStatus.LowStock;
                changed = true;
            }
            else if (inventory.Quantity > inventory.MinSafeQuantity && inventory.HasLowStockAlert)
            {
                inventory.HasLowStockAlert = false;
                changed = true;
            }

            if (inventory.EarliestExpiryDate.HasValue &&
                inventory.EarliestExpiryDate.Value <= expiryThreshold &&
                !inventory.HasExpiryAlert)
            {
                var daysToExpiry = (inventory.EarliestExpiryDate.Value - now).Days;
                var isExpired = daysToExpiry <= 0;

                alertDtos.Add(new AlertCreateDto
                {
                    Type = isExpired ? (int)AlertType.Expired : (int)AlertType.NearExpiry,
                    Level = isExpired ? (int)AlertLevel.Danger : (int)AlertLevel.Warning,
                    EnterpriseId = inventory.EnterpriseId,
                    ChemicalId = inventory.ChemicalId,
                    WarehouseId = inventory.WarehouseId,
                    Title = isExpired ? $"产品过期预警：{inventory.Chemical.Name}" : $"临期预警：{inventory.Chemical.Name}",
                    Content = $"{inventory.Enterprise.Name}的{inventory.Warehouse.Name}中{inventory.Chemical.Name}" +
                              $"{(isExpired ? $"已于{inventory.EarliestExpiryDate.Value:yyyy-MM-dd}过期" : $"将于{inventory.EarliestExpiryDate.Value:yyyy-MM-dd}过期，剩余{daysToExpiry}天")}",
                    Suggestion = isExpired ? "请立即封存并按危废处理流程处置" : "请优先安排出库，避免过期浪费",
                    RecipientRole = "Enterprise"
                });

                inventory.HasExpiryAlert = true;
                inventory.Status = isExpired ? InventoryStatus.Expired : InventoryStatus.NearExpiry;
                changed = true;
            }
            else if (inventory.EarliestExpiryDate.HasValue &&
                     inventory.EarliestExpiryDate.Value > expiryThreshold &&
                     inventory.HasExpiryAlert)
            {
                inventory.HasExpiryAlert = false;
                changed = true;
            }

            if (changed)
            {
                inventory.UpdatedAt = now;
                inventoriesToUpdate.Add(inventory);
            }
        }

        if (alertDtos.Any())
        {
            await CreateBatchAlertsAsync(alertDtos);
        }

        if (inventoriesToUpdate.Any())
        {
            await _inventoryRepo.UpdateRangeAsync(inventoriesToUpdate);
        }
    }

    public async Task CheckAndGenerateTransportAlertsAsync()
    {
        var anomalyDuration = _config.GetValue<int>("Alert:TransportDeviationDurationSec", 180) / 60;

        var inTransitRecords = await _transportRepo.GetQueryable()
            .Where(t => t.Status == TransportStatus.InTransit)
            .Include(t => t.Enterprise)
            .Include(t => t.ChemicalBatch)
            .ThenInclude(b => b.Chemical)
            .ToListAsync();

        var alertDtos = new List<AlertCreateDto>();

        foreach (var transport in inTransitRecords)
        {
            if (transport.IsDeviating && transport.DeviationStartTime.HasValue &&
                (DateTime.UtcNow - transport.DeviationStartTime.Value).TotalMinutes >= anomalyDuration)
            {
                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.TransportDeviation,
                    Level = (int)AlertLevel.Danger,
                    EnterpriseId = transport.EnterpriseId,
                    TransportRecordId = transport.Id,
                    Title = $"运输路线偏离告警：{transport.VehiclePlateNo}",
                    Content = $"车牌号{transport.VehiclePlateNo}运输{transport.ChemicalBatch.Chemical.Name}已偏离预设路线超过{anomalyDuration}分钟",
                    Suggestion = "请立即联系驾驶员确认情况，必要时启动应急预案",
                    RecipientRole = "Supervisor"
                });
            }

            if (transport.IsOverspeeding && transport.OverspeedingStartTime.HasValue &&
                (DateTime.UtcNow - transport.OverspeedingStartTime.Value).TotalMinutes >= anomalyDuration)
            {
                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.TransportOverspeeding,
                    Level = (int)AlertLevel.Warning,
                    EnterpriseId = transport.EnterpriseId,
                    TransportRecordId = transport.Id,
                    Title = $"运输超速告警：{transport.VehiclePlateNo}",
                    Content = $"车牌号{transport.VehiclePlateNo}运输{transport.ChemicalBatch.Chemical.Name}已超速行驶超过{anomalyDuration}分钟，当前速度{transport.CurrentSpeed:F1}km/h",
                    Suggestion = "请提醒驾驶员限速行驶，确保运输安全",
                    RecipientRole = "Enterprise"
                });
            }

            if (transport.IsTemperatureAbnormal)
            {
                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.TransportTemperatureAbnormal,
                    Level = (int)AlertLevel.Warning,
                    EnterpriseId = transport.EnterpriseId,
                    TransportRecordId = transport.Id,
                    Title = $"运输温度异常告警：{transport.VehiclePlateNo}",
                    Content = $"车牌号{transport.VehiclePlateNo}运输{transport.ChemicalBatch.Chemical.Name}车厢温度异常，当前温度{transport.CurrentTemperature:F1}℃",
                    Suggestion = "请检查温控设备，必要时调整运输方案",
                    RecipientRole = "Enterprise"
                });
            }
        }

        if (alertDtos.Any())
        {
            await CreateBatchAlertsAsync(alertDtos);
        }
    }

    public async Task CheckAndGenerateHazardAlertsAsync()
    {
        var escalationDays = _config.GetValue<int>("Alert:HazardEscalationDays", 3);

        var overdueHazards = await _hazardRepo.GetQueryable()
            .Where(h => h.Status == HazardRectificationStatus.Pending ||
                        h.Status == HazardRectificationStatus.InProgress)
            .Include(h => h.Enterprise)
            .ToListAsync();

        var alertDtos = new List<AlertCreateDto>();

        foreach (var hazard in overdueHazards)
        {
            var overdueDays = (DateTime.UtcNow - hazard.Deadline).TotalDays;

            if (overdueDays > 0 && hazard.Status != HazardRectificationStatus.Overdue)
            {
                hazard.Status = HazardRectificationStatus.Overdue;
                hazard.OverdueDays = (int)overdueDays;
                hazard.UpdatedAt = DateTime.UtcNow;

                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.HazardOverdue,
                    Level = hazard.Level == HazardLevel.Critical || hazard.Level == HazardLevel.Severe
                        ? (int)AlertLevel.Critical : (int)AlertLevel.Danger,
                    EnterpriseId = hazard.EnterpriseId,
                    HazardRectificationId = hazard.Id,
                    Title = $"隐患整改逾期：{hazard.WorkOrderNo}",
                    Content = $"{hazard.Enterprise.Name}的隐患工单{hazard.WorkOrderNo}已逾期{(int)overdueDays}天未完成",
                    Suggestion = "请立即督办，对责任企业进行约谈",
                    RecipientRole = "Supervisor"
                });
            }

            if (overdueDays >= escalationDays && !hazard.IsEscalated)
            {
                hazard.IsEscalated = true;
                hazard.EscalationLevel = 1;
                hazard.EscalationTime = DateTime.UtcNow;
                hazard.EscalationReason = $"整改期限已过{(int)overdueDays}天未完成";
                hazard.Status = HazardRectificationStatus.Escalated;
                hazard.UpdatedAt = DateTime.UtcNow;

                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.HazardEscalation,
                    Level = (int)AlertLevel.Critical,
                    EnterpriseId = hazard.EnterpriseId,
                    HazardRectificationId = hazard.Id,
                    Title = $"隐患整改升级督办：{hazard.WorkOrderNo}",
                    Content = $"{hazard.Enterprise.Name}的隐患工单{hazard.WorkOrderNo}已升级督办，" +
                              $"原因为：{hazard.EscalationReason}",
                    Suggestion = "请立即组织专项督查，严肃追责问责",
                    RecipientRole = "Supervisor"
                });
            }
        }

        if (alertDtos.Any())
        {
            await CreateBatchAlertsAsync(alertDtos);
        }

        await _hazardRepo.UpdateRangeAsync(overdueHazards);
    }

    public async Task CheckAndGenerateDrillAlertsAsync()
    {
        var now = DateTime.UtcNow;

        var overdueDrills = await _drillRepo.GetQueryable()
            .Where(d => d.Status == DrillStatus.Planned || d.Status == DrillStatus.Scheduled)
            .Include(d => d.Enterprise)
            .ToListAsync();

        var alertDtos = new List<AlertCreateDto>();

        foreach (var drill in overdueDrills)
        {
            var daysOverdue = (now - drill.PlannedStartTime).TotalDays;

            if (daysOverdue > 0 && drill.Status != DrillStatus.Overdue)
            {
                drill.Status = DrillStatus.Overdue;
                drill.HasSupervisionReminder = true;
                drill.SupervisionReminderCount = (drill.SupervisionReminderCount ?? 0) + 1;
                drill.LastSupervisionReminderTime = now;
                drill.UpdatedAt = now;

                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.DrillOverdue,
                    Level = (int)AlertLevel.Warning,
                    EnterpriseId = drill.EnterpriseId,
                    EmergencyDrillId = drill.Id,
                    Title = $"应急演练逾期：{drill.PlanNo}",
                    Content = $"{drill.Enterprise.Name}的演练计划{drill.PlanNo}-{drill.Name}已逾期{(int)daysOverdue}天未执行",
                    Suggestion = "请督促企业立即组织演练，未按计划执行的责令限期整改",
                    RecipientRole = "Enterprise"
                });
            }
            else if (daysOverdue > 0 && drill.SupervisionReminderCount < 3)
            {
                drill.SupervisionReminderCount = (drill.SupervisionReminderCount ?? 0) + 1;
                drill.LastSupervisionReminderTime = now;
                drill.UpdatedAt = now;

                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.DrillSupervision,
                    Level = (int)AlertLevel.Info,
                    EnterpriseId = drill.EnterpriseId,
                    EmergencyDrillId = drill.Id,
                    Title = $"应急演练督办提醒：{drill.PlanNo}",
                    Content = $"第{drill.SupervisionReminderCount}次提醒：{drill.Enterprise.Name}的演练计划{drill.PlanNo}已逾期{(int)daysOverdue}天",
                    Suggestion = "请尽快安排演练执行，逾期3次将上报上级部门",
                    RecipientRole = "Enterprise",
                    RecipientUserId = null
                });
            }
        }

        if (alertDtos.Any())
        {
            await CreateBatchAlertsAsync(alertDtos);
        }

        await _drillRepo.UpdateRangeAsync(overdueDrills);
    }

    public async Task CheckAndGenerateCertificateAlertsAsync()
    {
        var nearExpiryDays = _config.GetValue<int>("Alert:CertificateExpiringDays", 30);
        var now = DateTime.UtcNow;

        var certs = await _certRepo.GetQueryable()
            .Where(c => c.Status == CertificateStatus.Valid || c.Status == CertificateStatus.Expiring)
            .Include(c => c.Enterprise)
            .ToListAsync();

        var alertDtos = new List<AlertCreateDto>();

        foreach (var cert in certs)
        {
            var daysToExpiry = (cert.ExpiryDate - now).TotalDays;

            if (daysToExpiry <= 0 && cert.Status != CertificateStatus.Expired)
            {
                cert.Status = CertificateStatus.Expired;
                cert.Verified = false;
                cert.VerificationResult = "证书已过期";
                cert.LastVerifiedTime = now;
                cert.UpdatedAt = now;

                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.CertificateExpired,
                    Level = (int)AlertLevel.Danger,
                    EnterpriseId = cert.EnterpriseId,
                    CertificateId = cert.Id,
                    Title = $"资质证书过期：{cert.CertificateNo}",
                    Content = $"{cert.HolderName}的{cert.Type}证书({cert.CertificateNo})已于{cert.ExpiryDate:yyyy-MM-dd}过期",
                    Suggestion = "请立即更新证书，暂停相关作业活动",
                    RecipientRole = "Enterprise"
                });
            }
            else if (daysToExpiry > 0 && daysToExpiry <= nearExpiryDays && cert.Status != CertificateStatus.Expiring)
            {
                cert.Status = CertificateStatus.Expiring;
                cert.UpdatedAt = now;

                alertDtos.Add(new AlertCreateDto
                {
                    Type = (int)AlertType.CertificateExpiring,
                    Level = (int)AlertLevel.Warning,
                    EnterpriseId = cert.EnterpriseId,
                    CertificateId = cert.Id,
                    Title = $"资质证书即将到期：{cert.CertificateNo}",
                    Content = $"{cert.HolderName}的{cert.Type}证书({cert.CertificateNo})将于{cert.ExpiryDate:yyyy-MM-dd}到期，剩余{(int)daysToExpiry}天",
                    Suggestion = "请及时办理证书续期，避免影响正常生产经营",
                    RecipientRole = "Enterprise"
                });
            }
        }

        if (alertDtos.Any())
        {
            await CreateBatchAlertsAsync(alertDtos);
        }

        await _certRepo.UpdateRangeAsync(certs);
    }
}
