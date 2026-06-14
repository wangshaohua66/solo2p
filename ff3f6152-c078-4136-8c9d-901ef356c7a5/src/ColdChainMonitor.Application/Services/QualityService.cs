using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.Services;

public class QualityService
{
    private readonly IQualityReportRepository _reportRepository;
    private readonly ITransportTaskRepository _taskRepository;
    private readonly ITemperatureReadingRepository _readingRepository;
    private readonly IAlertRepository _alertRepository;
    private readonly IAuditLogRepository _auditLogRepository;

    public QualityService(
        IQualityReportRepository reportRepository,
        ITransportTaskRepository taskRepository,
        ITemperatureReadingRepository readingRepository,
        IAlertRepository alertRepository,
        IAuditLogRepository auditLogRepository)
    {
        _reportRepository = reportRepository;
        _taskRepository = taskRepository;
        _readingRepository = readingRepository;
        _alertRepository = alertRepository;
        _auditLogRepository = auditLogRepository;
    }

    public async Task<QualityReportDto?> GetByIdAsync(string id)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        return report == null ? null : MapToDto(report);
    }

    public async Task<QualityReportDto?> GetByReportNoAsync(string reportNo)
    {
        var report = await _reportRepository.GetByReportNoAsync(reportNo);
        return report == null ? null : MapToDto(report);
    }

    public async Task<QualityReportDto?> GetByTaskIdAsync(string taskId)
    {
        var report = await _reportRepository.GetByTransportTaskIdAsync(taskId);
        return report == null ? null : MapToDto(report);
    }

    public async Task<CursorPagedResult<QualityReportDto>> GetPagedAsync(QualityReportQueryRequest request)
    {
        var result = await _reportRepository.GetPagedAsync(
            request.Result,
            request.Keyword,
            request.TaskNo,
            request.InspectorId,
            request.StartTime,
            request.EndTime,
            request.Cursor,
            request.Limit,
            request.SortDesc);

        return new CursorPagedResult<QualityReportDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            NextCursor = result.NextCursor,
            HasMore = result.HasMore,
            Limit = result.Limit,
            TotalCount = result.TotalCount
        };
    }

    public async Task<QualityReportDto> CreateReportAsync(string taskId, string inspectorId, string inspectorName)
    {
        var task = await _taskRepository.GetByIdAsync(taskId);
        if (task == null)
            throw new ArgumentException("运输任务不存在");

        var existingReport = await _reportRepository.GetByTransportTaskIdAsync(taskId);
        if (existingReport != null)
            throw new InvalidOperationException("该任务已有质检报告");

        var temperatureSummary = await CalculateTemperatureSummaryAsync(task);
        var alertSummary = await CalculateAlertSummaryAsync(taskId);

        var reportNo = GenerateReportNo();
        var report = new QualityReport
        {
            ReportNo = reportNo,
            TransportTaskId = taskId,
            TaskNo = task.TaskNo,
            DrugBatch = new DrugBatchInfo
            {
                BatchNo = task.DrugBatch.BatchNo,
                DrugName = task.DrugBatch.DrugName,
                DrugType = task.DrugBatch.DrugType,
                Quantity = task.DrugBatch.Quantity,
                Unit = task.DrugBatch.Unit,
                Manufacturer = task.DrugBatch.Manufacturer,
                ProductionDate = task.DrugBatch.ProductionDate,
                ExpiryDate = task.DrugBatch.ExpiryDate
            },
            InspectorId = inspectorId,
            InspectorName = inspectorName,
            Result = QualityResult.Pending,
            TemperatureSummary = temperatureSummary,
            AlertSummary = alertSummary,
            Conclusion = string.Empty,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _reportRepository.AddAsync(report);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Create,
            ActionName = "生成质检报告",
            Module = "Quality",
            EntityType = "QualityReport",
            EntityId = report.Id,
            OperatorId = inspectorId,
            OperatorName = inspectorName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapToDto(report);
    }

    public async Task<QualityReportDto?> SubmitQualityCheckAsync(QualityCheckRequest request, string inspectorId, string inspectorName)
    {
        var report = await _reportRepository.GetByTransportTaskIdAsync(request.TransportTaskId);
        if (report == null)
            throw new ArgumentException("质检报告不存在");

        var oldValue = System.Text.Json.JsonSerializer.Serialize(report);

        report.Result = request.Result;
        report.Conclusion = request.Conclusion;
        report.RejectReason = request.RejectReason;
        report.Suggestions = request.Suggestions;
        report.InspectorId = inspectorId;
        report.InspectorName = inspectorName;
        report.InspectedAt = DateTime.UtcNow;
        report.SignedAt = DateTime.UtcNow;
        report.UpdatedAt = DateTime.UtcNow;

        await _reportRepository.UpdateAsync(report.Id, report);

        var task = await _taskRepository.GetByIdAsync(request.TransportTaskId);
        if (task != null && task.Status == TransportStatus.QualityChecking)
        {
            var statusRecord = new StatusChangeRecord
            {
                FromStatus = TransportStatus.QualityChecking,
                ToStatus = TransportStatus.Completed,
                OperatorId = inspectorId,
                OperatorName = inspectorName,
                Timestamp = DateTime.UtcNow,
                Remarks = "质检完成"
            };
            await _taskRepository.UpdateStatusAsync(task.Id, TransportStatus.Completed, statusRecord);
        }

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.StatusChange,
            ActionName = "提交质检结果",
            Module = "Quality",
            EntityType = "QualityReport",
            EntityId = report.Id,
            OperatorId = inspectorId,
            OperatorName = inspectorName,
            OldValue = oldValue,
            NewValue = System.Text.Json.JsonSerializer.Serialize(report),
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapToDto(report);
    }

    private async Task<TemperatureSummary> CalculateTemperatureSummaryAsync(TransportTask task)
    {
        var startTime = task.ActualDepartureAt ?? task.PlannedDepartureAt;
        var endTime = task.ActualArrivalAt ?? task.PlannedArrivalAt;

        var statsList = new List<(double avg, double max, double min, long total, long anomaly)>();
        var totalRecords = 0L;
        var anomalyRecords = 0L;
        var sumTemp = 0.0;
        var maxTemp = double.MinValue;
        var minTemp = double.MaxValue;

        foreach (var deviceId in task.DeviceIds)
        {
            var stats = await _readingRepository.GetStatsAsync(deviceId, startTime, endTime);
            statsList.Add(stats);
            totalRecords += stats.total;
            anomalyRecords += stats.anomaly;

            if (stats.total > 0)
            {
                sumTemp += stats.avg * stats.total;
                maxTemp = Math.Max(maxTemp, stats.max);
                minTemp = Math.Min(minTemp, stats.min);
            }
        }

        var avgTemp = totalRecords > 0 ? sumTemp / totalRecords : 0;
        if (maxTemp == double.MinValue) maxTemp = 0;
        if (minTemp == double.MaxValue) minTemp = 0;

        var durationMinutes = (endTime - startTime).TotalMinutes;
        var outOfRangeMinutes = durationMinutes > 0 && totalRecords > 0
            ? durationMinutes * (anomalyRecords / (double)totalRecords)
            : 0;
        var complianceRate = totalRecords > 0
            ? (double)(totalRecords - anomalyRecords) / totalRecords * 100
            : 100;

        return new TemperatureSummary
        {
            AvgTemperature = Math.Round(avgTemp, 2),
            MaxTemperature = Math.Round(maxTemp, 2),
            MinTemperature = Math.Round(minTemp, 2),
            TotalRecords = totalRecords,
            AnomalyRecords = anomalyRecords,
            TransportDurationMinutes = Math.Round(durationMinutes, 2),
            OutOfRangeDurationMinutes = Math.Round(outOfRangeMinutes, 2),
            ComplianceRate = Math.Round(complianceRate, 2)
        };
    }

    private async Task<AlertSummary> CalculateAlertSummaryAsync(string taskId)
    {
        var alerts = await _alertRepository.GetPagedAsync(
            null, null, null, null, null, taskId, null, null, null, 1000);

        var criticalCount = alerts.Items.Count(a => a.AlertLevel == AlertLevel.Critical || a.AlertLevel == AlertLevel.Fatal);
        var warningCount = alerts.Items.Count(a => a.AlertLevel == AlertLevel.Warning);
        var acknowledgedCount = alerts.Items.Count(a => a.IsAcknowledged);
        var resolvedCount = alerts.Items.Count(a => a.IsResolved);

        var alertTypeCounts = alerts.Items
            .GroupBy(a => a.AlertType)
            .Select(g => new AlertTypeCount
            {
                AlertType = g.Key,
                Count = g.Count()
            })
            .ToList();

        return new AlertSummary
        {
            TotalAlerts = alerts.Items.Count,
            CriticalAlerts = criticalCount,
            WarningAlerts = warningCount,
            AcknowledgedAlerts = acknowledgedCount,
            ResolvedAlerts = resolvedCount,
            AlertTypes = alertTypeCounts
        };
    }

    private static string GenerateReportNo()
    {
        return $"QR{DateTime.UtcNow:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";
    }

    private static QualityReportDto MapToDto(QualityReport report)
    {
        return new QualityReportDto
        {
            Id = report.Id,
            ReportNo = report.ReportNo,
            TransportTaskId = report.TransportTaskId,
            TaskNo = report.TaskNo,
            DrugBatch = new DrugBatchDto
            {
                BatchNo = report.DrugBatch.BatchNo,
                DrugName = report.DrugBatch.DrugName,
                DrugType = report.DrugBatch.DrugType,
                Quantity = report.DrugBatch.Quantity,
                Unit = report.DrugBatch.Unit,
                Manufacturer = report.DrugBatch.Manufacturer,
                ProductionDate = report.DrugBatch.ProductionDate,
                ExpiryDate = report.DrugBatch.ExpiryDate
            },
            InspectorId = report.InspectorId,
            InspectorName = report.InspectorName,
            Result = report.Result,
            ResultText = GetResultText(report.Result),
            TemperatureSummary = new TemperatureSummaryDto
            {
                AvgTemperature = report.TemperatureSummary.AvgTemperature,
                MaxTemperature = report.TemperatureSummary.MaxTemperature,
                MinTemperature = report.TemperatureSummary.MinTemperature,
                AvgHumidity = report.TemperatureSummary.AvgHumidity,
                MaxHumidity = report.TemperatureSummary.MaxHumidity,
                MinHumidity = report.TemperatureSummary.MinHumidity,
                TotalRecords = report.TemperatureSummary.TotalRecords,
                AnomalyRecords = report.TemperatureSummary.AnomalyRecords,
                TransportDurationMinutes = report.TemperatureSummary.TransportDurationMinutes,
                OutOfRangeDurationMinutes = report.TemperatureSummary.OutOfRangeDurationMinutes,
                ComplianceRate = report.TemperatureSummary.ComplianceRate
            },
            AlertSummary = new AlertSummaryDto
            {
                TotalAlerts = report.AlertSummary.TotalAlerts,
                CriticalAlerts = report.AlertSummary.CriticalAlerts,
                WarningAlerts = report.AlertSummary.WarningAlerts,
                AcknowledgedAlerts = report.AlertSummary.AcknowledgedAlerts,
                ResolvedAlerts = report.AlertSummary.ResolvedAlerts
            },
            Conclusion = report.Conclusion,
            RejectReason = report.RejectReason,
            Suggestions = report.Suggestions,
            InspectedAt = report.InspectedAt,
            SignedAt = report.SignedAt,
            CreatedAt = report.CreatedAt,
            UpdatedAt = report.UpdatedAt
        };
    }

    private static string GetResultText(QualityResult result)
    {
        return result switch
        {
            QualityResult.Pending => "待质检",
            QualityResult.Accepted => "签收",
            QualityResult.Rejected => "拒收",
            QualityResult.ConditionalAccepted => "有条件签收",
            _ => "未知"
        };
    }
}
