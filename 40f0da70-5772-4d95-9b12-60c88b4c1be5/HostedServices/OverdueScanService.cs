using System.Text;
using CampHub.Models;
using CampHub.Services;
using MongoDB.Driver;

namespace CampHub.HostedServices;

public class OverdueScanService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<OverdueScanService> _logger;

    public OverdueScanService(IServiceProvider sp, ILogger<OverdueScanService> logger)
    {
        _sp = sp;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OverdueScanService 启动，每日 02:00 执行逾期扫描");

        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = DateTime.UtcNow;
                var targetHour = 18; // UTC 18:00 = 北京时间 02:00
                if (now.Hour == targetHour)
                {
                    await RunDailyScanAsync(stoppingToken);
                    await Task.Delay(TimeSpan.FromHours(23), stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "逾期扫描任务异常");
            }

            try { await timer.WaitForNextTickAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunDailyScanAsync(CancellationToken ct)
    {
        _logger.LogInformation("开始执行每日逾期装备扫描...");

        using var scope = _sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MongoContext>();

        var now = DateTime.UtcNow;
        var today = now.Date;
        var overdueFilter = Builders<Gear>.Filter.And(
            Builders<Gear>.Filter.Eq(g => g.Status, GearStatus.Lent),
            Builders<Gear>.Filter.Lt(g => g.DueDate, now));
        var overdueGears = await db.Gears.Find(overdueFilter).ToListAsync(ct);
        if (!overdueGears.Any())
        {
            _logger.LogInformation("逾期扫描完成：无逾期装备");
            return;
        }

        int notifiedCount = 0;
        int creditPenaltyCount = 0;
        var sb = new StringBuilder();

        foreach (var gear in overdueGears)
        {
            if (gear.CurrentBorrowerId == null || gear.DueDate == null) continue;

            var daysOverdue = (int)Math.Ceiling((now - gear.DueDate.Value).TotalDays);
            var dayKey = $"overdue_day_{today:yyyyMMdd}_{gear.Id}";

            var alreadyLogged = await db.CreditLogs
                .Find(cl => cl.UserId == gear.CurrentBorrowerId && cl.Reason.Contains(dayKey))
                .AnyAsync(ct);
            if (alreadyLogged) continue;

            int penalty = 2;
            var log = new CreditLog
            {
                UserId = gear.CurrentBorrowerId,
                Delta = -penalty,
                Reason = $"逾期第{daysOverdue}天催还 [{dayKey}] 装备：{gear.Name}",
                CreatedAt = now
            };
            await db.CreditLogs.InsertOneAsync(log, cancellationToken: ct);

            await db.Users.UpdateOneAsync(
                u => u.Id == gear.CurrentBorrowerId,
                Builders<User>.Update.Inc(u => u.CreditScore, -penalty),
                cancellationToken: ct);

            creditPenaltyCount++;
            notifiedCount++;
            sb.AppendLine($"  - {gear.Name}: 逾期{daysOverdue}天, 借用人 {gear.CurrentBorrowerId}, 扣{penalty}分");
        }

        _logger.LogInformation("逾期扫描完成：共 {count} 件逾期, 本日新增 {penalty} 笔扣分\n{details}",
            overdueGears.Count, creditPenaltyCount, sb.ToString());
    }
}
