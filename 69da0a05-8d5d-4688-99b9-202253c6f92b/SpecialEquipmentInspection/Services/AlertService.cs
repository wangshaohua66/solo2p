using Microsoft.Extensions.Options;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Repositories;

namespace SpecialEquipmentInspection.Services;

public interface IAlertService
{
    Task<int> CheckOverdueRectificationsAsync();
    Task<int> CheckExpiringInspectorCertsAsync();
    Task<int> RunAllAsync();
}

public class AlertService : IAlertService
{
    private readonly IInspectionRepository _inspections;
    private readonly IInspectorRepository _inspectors;
    private readonly InspectionOptions _options;
    private readonly ILogger<AlertService> _logger;

    public AlertService(
        IInspectionRepository inspections,
        IInspectorRepository inspectors,
        IOptions<InspectionOptions> options,
        ILogger<AlertService> logger)
    {
        _inspections = inspections;
        _inspectors = inspectors;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<int> CheckOverdueRectificationsAsync()
    {
        var overdue = await _inspections.GetOverdueRectificationsAsync();
        var handled = 0;
        var now = DateTime.Now;

        foreach (var rect in overdue)
        {
            var wasOverdue = rect.Status == RectificationStatus.Overdue;
            var wasReported = rect.ReportedToSupervisor;

            rect.Status = RectificationStatus.Overdue;
            rect.WarningLevel = Math.Min(rect.WarningLevel + 1, 3);

            if (!rect.WarningSent)
            {
                rect.WarningSent = true;
                _logger.LogInformation("【整改预警】设备{DeviceId}整改单{RectId}已超期，已向使用单位{UseUnit}发送预警通知。截止日期：{Deadline}",
                    rect.DeviceId, rect.Id, rect.UseUnitName, rect.Deadline);
            }

            if (!wasReported && rect.Deadline < now.AddDays(-1))
            {
                rect.ReportedToSupervisor = true;
                var ins = await _inspections.GetInspectionByIdAsync(rect.InspectionId);
                var sr = new SupervisionReport
                {
                    ReportCode = $"SUP-OD-{now:yyyyMMddHHmmss}-{rect.Id}",
                    RectificationId = rect.Id,
                    InspectionId = rect.InspectionId,
                    DeviceId = rect.DeviceId,
                    DeviceCode = ins?.DeviceCode ?? string.Empty,
                    ReportType = "整改超期监察上报",
                    Payload = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        rect.Description,
                        rect.Deadline,
                        OverdueDays = (now - rect.Deadline).TotalDays.ToString("F1"),
                        rect.UseUnitName,
                        rect.UseUnitCode
                    }),
                    Status = SupervisionReportStatus.Pending,
                    Remark = "整改超期自动上报监察部门"
                };
                await _inspections.AddSupervisionReportAsync(sr);
                _logger.LogWarning("【监察上报】整改超期已上报监察部门。整改单{RectId}，设备{DeviceId}", rect.Id, rect.DeviceId);
            }

            await _inspections.UpdateRectificationAsync(rect);
            if (!wasOverdue || !rect.WarningSent) handled++;
        }

        return handled;
    }

    public async Task<int> CheckExpiringInspectorCertsAsync()
    {
        var expiring = await _inspectors.GetExpiringAsync(_options.WarningBeforeExpiryDays);
        foreach (var inspector in expiring)
        {
            var daysLeft = (inspector.ExpiryDate - DateTime.Now).TotalDays;
            _logger.LogInformation("【资质提醒】检验员{Name}（证书{CertNo}）将于{Expiry:yyyy-MM-dd}到期，剩余{Days:F0}天，请及时续证。",
                inspector.Name, inspector.CertificateNo, inspector.ExpiryDate, daysLeft);
        }
        return expiring.Count;
    }

    public async Task<int> RunAllAsync()
    {
        var overdueHandled = await CheckOverdueRectificationsAsync();
        await CheckExpiringInspectorCertsAsync();
        return overdueHandled;
    }
}

public class AlertBackgroundService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<AlertBackgroundService> _logger;

    public AlertBackgroundService(IServiceProvider sp, ILogger<AlertBackgroundService> logger)
    {
        _sp = sp;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("整改预警后台服务已启动，每5分钟检查一次超期整改与资质到期。");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _sp.CreateScope();
                var alert = scope.ServiceProvider.GetRequiredService<IAlertService>();
                await alert.RunAllAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "整改预警后台任务执行异常");
            }
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
