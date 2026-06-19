using Microsoft.EntityFrameworkCore;
using MiningGovApi.Data;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;

namespace MiningGovApi.Services;

public interface ISafetyService
{
    Task SubmitSensorDataAsync(SensorDataSubmitDto dto);
    Task<int> BatchSubmitSensorDataAsync(List<SensorDataSubmitDto> dtos);
    Task<SafetyAlertDto> GetAlertByIdAsync(int id);
    Task<PagedResult<SafetyAlertDto>> QueryAlertsAsync(SafetyAlertQueryDto query);
    Task<SafetyAlertDto> HandleAlertAsync(SafetyAlertHandleDto dto, int handlerId);
    Task<List<SensorThresholdDto>> GetSensorThresholdsAsync(int mineId);
    Task<SensorThresholdDto> SetSensorThresholdAsync(SensorThresholdCreateDto dto);
    Task CheckAndEscalateAlertsAsync();
}

public class SafetyService : ISafetyService
{
    private readonly AppDbContext _dbContext;
    private const int AlertEscalationHours = 4;

    public SafetyService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task SubmitSensorDataAsync(SensorDataSubmitDto dto)
    {
        var sensorData = new SensorData
        {
            MineId = dto.MineId,
            SensorType = dto.SensorType,
            SensorCode = dto.SensorCode,
            Value = dto.Value,
            Timestamp = DateTime.UtcNow
        };

        _dbContext.SensorData.Add(sensorData);
        await _dbContext.SaveChangesAsync();

        await CheckThresholdAndCreateAlertAsync(dto.MineId, dto.SensorType, dto.SensorCode, dto.Value);
    }

    public async Task<int> BatchSubmitSensorDataAsync(List<SensorDataSubmitDto> dtos)
    {
        if (dtos == null || dtos.Count == 0)
            return 0;

        var sensorDataList = dtos.Select(d => new SensorData
        {
            MineId = d.MineId,
            SensorType = d.SensorType,
            SensorCode = d.SensorCode,
            Value = d.Value,
            Timestamp = DateTime.UtcNow
        }).ToList();

        _dbContext.SensorData.AddRange(sensorDataList);
        var count = await _dbContext.SaveChangesAsync();

        var groupedBySensor = dtos
            .GroupBy(d => new { d.MineId, d.SensorType, d.SensorCode })
            .Select(g => g.OrderByDescending(x => x.Value).First())
            .ToList();

        foreach (var dto in groupedBySensor)
        {
            await CheckThresholdAndCreateAlertAsync(dto.MineId, dto.SensorType, dto.SensorCode, dto.Value);
        }

        return count;
    }

    public async Task<SafetyAlertDto> GetAlertByIdAsync(int id)
    {
        var alert = await _dbContext.SafetyAlerts
            .Include(sa => sa.Mine)
            .Include(sa => sa.AssignedInspector)
            .Include(sa => sa.Disposals)
                .ThenInclude(d => d.Handler)
            .FirstOrDefaultAsync(sa => sa.Id == id);

        if (alert == null)
        {
            throw new KeyNotFoundException($"安全预警ID {id} 不存在");
        }

        return MapToDto(alert);
    }

    public async Task<PagedResult<SafetyAlertDto>> QueryAlertsAsync(SafetyAlertQueryDto query)
    {
        var q = _dbContext.SafetyAlerts
            .Include(sa => sa.Mine)
            .Include(sa => sa.AssignedInspector)
            .AsQueryable();

        if (query.MineId.HasValue)
            q = q.Where(sa => sa.MineId == query.MineId.Value);
        if (query.Status.HasValue)
            q = q.Where(sa => sa.Status == query.Status.Value);
        if (query.Level.HasValue)
            q = q.Where(sa => sa.Level == query.Level.Value);
        if (query.StartTime.HasValue)
            q = q.Where(sa => sa.CreatedAt >= query.StartTime.Value);
        if (query.EndTime.HasValue)
            q = q.Where(sa => sa.CreatedAt <= query.EndTime.Value);

        var totalCount = await q.CountAsync();
        var items = await q
            .OrderByDescending(sa => sa.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        var dtos = items.Select(MapToDto).ToList();

        return new PagedResult<SafetyAlertDto>
        {
            TotalCount = totalCount,
            PageIndex = query.PageIndex,
            PageSize = query.PageSize,
            Items = dtos
        };
    }

    public async Task<SafetyAlertDto> HandleAlertAsync(SafetyAlertHandleDto dto, int handlerId)
    {
        var alert = await _dbContext.SafetyAlerts.FindAsync(dto.AlertId);
        if (alert == null)
        {
            throw new KeyNotFoundException($"安全预警ID {dto.AlertId} 不存在");
        }

        if (alert.Status == AlertStatus.Closed)
        {
            throw new InvalidOperationException("该预警已关闭，无法再处置");
        }

        if (alert.Status == AlertStatus.Created || alert.Status == AlertStatus.Assigned)
        {
            alert.RespondedAt = DateTime.UtcNow;
            alert.Status = AlertStatus.Responded;
        }

        var disposal = new SafetyAlertDisposal
        {
            SafetyAlertId = dto.AlertId,
            HandlerId = handlerId,
            Action = dto.Action,
            Result = dto.Result,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.SafetyAlertDisposals.Add(disposal);

        if (!string.IsNullOrEmpty(dto.Result))
        {
            alert.DisposalNote = dto.Result;
            alert.Status = AlertStatus.Closed;
            alert.ClosedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync();
        return await GetAlertByIdAsync(dto.AlertId);
    }

    public async Task<List<SensorThresholdDto>> GetSensorThresholdsAsync(int mineId)
    {
        var thresholds = await _dbContext.SensorThresholds
            .Where(st => st.MineId == mineId)
            .ToListAsync();

        return thresholds.Select(st => new SensorThresholdDto
        {
            Id = st.Id,
            MineId = st.MineId,
            SensorType = st.SensorType,
            SensorCode = st.SensorCode,
            WarningThreshold = st.WarningThreshold,
            CriticalThreshold = st.CriticalThreshold,
            IsEnabled = st.IsEnabled
        }).ToList();
    }

    public async Task<SensorThresholdDto> SetSensorThresholdAsync(SensorThresholdCreateDto dto)
    {
        var existing = await _dbContext.SensorThresholds
            .FirstOrDefaultAsync(st => st.MineId == dto.MineId && st.SensorCode == dto.SensorCode);

        if (existing != null)
        {
            existing.WarningThreshold = dto.WarningThreshold;
            existing.CriticalThreshold = dto.CriticalThreshold;
            existing.SensorType = dto.SensorType;
        }
        else
        {
            var threshold = new SensorThreshold
            {
                MineId = dto.MineId,
                SensorType = dto.SensorType,
                SensorCode = dto.SensorCode,
                WarningThreshold = dto.WarningThreshold,
                CriticalThreshold = dto.CriticalThreshold,
                IsEnabled = true,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.SensorThresholds.Add(threshold);
            existing = threshold;
        }

        await _dbContext.SaveChangesAsync();

        return new SensorThresholdDto
        {
            Id = existing.Id,
            MineId = existing.MineId,
            SensorType = existing.SensorType,
            SensorCode = existing.SensorCode,
            WarningThreshold = existing.WarningThreshold,
            CriticalThreshold = existing.CriticalThreshold,
            IsEnabled = existing.IsEnabled
        };
    }

    public async Task CheckAndEscalateAlertsAsync()
    {
        var cutoffTime = DateTime.UtcNow.AddHours(-AlertEscalationHours);
        var alertsToEscalate = await _dbContext.SafetyAlerts
            .Where(sa => (sa.Status == AlertStatus.Created || sa.Status == AlertStatus.Assigned)
                        && sa.CreatedAt < cutoffTime)
            .ToListAsync();

        foreach (var alert in alertsToEscalate)
        {
            alert.Status = AlertStatus.Escalated;
            alert.EscalatedAt = DateTime.UtcNow;

            var supervisor = await _dbContext.Users
                .FirstOrDefaultAsync(u => u.Role == UserRole.SafetyInspector);
            if (supervisor != null)
            {
                alert.EscalatedToId = supervisor.Id;
            }
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task CheckThresholdAndCreateAlertAsync(int mineId, SensorType sensorType, string sensorCode, decimal value)
    {
        var threshold = await _dbContext.SensorThresholds
            .FirstOrDefaultAsync(st => st.MineId == mineId && st.SensorCode == sensorCode && st.IsEnabled);

        if (threshold == null) return;

        AlertLevel? level = null;
        string description = string.Empty;

        if (value >= threshold.CriticalThreshold)
        {
            level = AlertLevel.Critical;
            description = $"{sensorType}传感器读数 {value} 超过临界阈值 {threshold.CriticalThreshold}";
        }
        else if (value >= threshold.WarningThreshold)
        {
            level = AlertLevel.Warning;
            description = $"{sensorType}传感器读数 {value} 超过警告阈值 {threshold.WarningThreshold}";
        }

        if (level.HasValue)
        {
            var recentAlert = await _dbContext.SafetyAlerts
                .Where(sa => sa.MineId == mineId && sa.SensorCode == sensorCode
                    && sa.Status != AlertStatus.Closed && sa.CreatedAt > DateTime.UtcNow.AddHours(-1))
                .FirstOrDefaultAsync();

            if (recentAlert == null)
            {
                var inspector = await _dbContext.Users
                    .FirstOrDefaultAsync(u => u.Role == UserRole.SafetyInspector && u.IsActive);

                var alert = new SafetyAlert
                {
                    MineId = mineId,
                    SensorType = sensorType,
                    SensorCode = sensorCode,
                    TriggerValue = value,
                    Level = level.Value,
                    Status = inspector != null ? AlertStatus.Assigned : AlertStatus.Created,
                    AssignedInspectorId = inspector?.Id,
                    Description = description,
                    CreatedAt = DateTime.UtcNow,
                    AssignedAt = inspector != null ? DateTime.UtcNow : null
                };

                _dbContext.SafetyAlerts.Add(alert);
                await _dbContext.SaveChangesAsync();
            }
        }
    }

    private static SafetyAlertDto MapToDto(SafetyAlert alert)
    {
        return new SafetyAlertDto
        {
            Id = alert.Id,
            MineId = alert.MineId,
            MineName = alert.Mine?.Name ?? string.Empty,
            SensorType = alert.SensorType,
            SensorCode = alert.SensorCode,
            TriggerValue = alert.TriggerValue,
            Level = alert.Level,
            Status = alert.Status,
            AssignedInspectorId = alert.AssignedInspectorId,
            AssignedInspectorName = alert.AssignedInspector?.RealName,
            Description = alert.Description,
            CreatedAt = alert.CreatedAt,
            AssignedAt = alert.AssignedAt,
            RespondedAt = alert.RespondedAt,
            EscalatedAt = alert.EscalatedAt,
            ClosedAt = alert.ClosedAt,
            DisposalNote = alert.DisposalNote
        };
    }
}
