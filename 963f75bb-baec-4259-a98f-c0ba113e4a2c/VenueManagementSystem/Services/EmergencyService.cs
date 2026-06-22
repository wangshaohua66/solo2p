using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using VenueManagementSystem.Common;
using VenueManagementSystem.Data;
using VenueManagementSystem.Models;
using VenueManagementSystem.Services.Interfaces;

namespace VenueManagementSystem.Services;

/// <summary>
/// 应急管理服务实现类
/// 提供应急预案触发、处理、跟踪、报告等功能
/// 触发后自动调用 NotificationService 推送通知
/// </summary>
public class EmergencyService : IEmergencyService
{
    private readonly AppDbContext _context;
    private readonly IDatabase _redis;
    private readonly ILogger<EmergencyService> _logger;
    private readonly INotificationService _notificationService;
    private readonly IRedisPublisher _redisPublisher;
    private readonly IAuthService _authService;

    /// <summary>
    /// 初始化应急管理服务
    /// </summary>
    /// <param name="context">数据上下文</param>
    /// <param name="redis">Redis数据库</param>
    /// <param name="logger">日志记录器</param>
    /// <param name="notificationService">通知服务</param>
    /// <param name="redisPublisher">Redis消息发布者</param>
    /// <param name="authService">认证服务</param>
    public EmergencyService(
        AppDbContext context,
        IDatabase redis,
        ILogger<EmergencyService> logger,
        INotificationService notificationService,
        IRedisPublisher redisPublisher,
        IAuthService authService)
    {
        _context = context;
        _redis = redis;
        _logger = logger;
        _notificationService = notificationService;
        _redisPublisher = redisPublisher;
        _authService = authService;
    }

    /// <summary>
    /// 异步获取所有应急预案
    /// </summary>
    /// <returns>预案列表</returns>
    public async Task<IEnumerable<EmergencyPlan>> GetEmergencyPlansAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取所有应急预案");

            var cacheKey = $"{RedisKeyPrefix.EmergencyPlan}all";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedPlans = Newtonsoft.Json.JsonConvert.DeserializeObject<List<EmergencyPlan>>(cachedData!);
                if (cachedPlans != null && cachedPlans.Any())
                {
                    _logger.LogInformation("从Redis缓存获取应急预案成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedPlans.Count, stopwatch.ElapsedMilliseconds);
                    return cachedPlans;
                }
            }

            var plans = await _context.EmergencyPlans
                .AsNoTracking()
                .OrderBy(p => p.Id)
                .ToListAsync();

            if (plans.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(plans),
                    TimeSpan.FromHours(1));
            }

            _logger.LogInformation("获取应急预案成功，共{Count}条，耗时: {Elapsed}ms",
                plans.Count, stopwatch.ElapsedMilliseconds);

            return plans;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取应急预案失败");
            throw new InvalidOperationException("获取应急预案失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步触发应急预案
    /// 触发后自动调用NotificationService推送通知
    /// </summary>
    /// <param name="planId">预案ID</param>
    /// <param name="venueId">场馆ID</param>
    /// <param name="triggeredBy">触发人ID</param>
    /// <param name="remarks">触发备注</param>
    /// <returns>应急日志ID</returns>
    public async Task<int> TriggerEmergencyAsync(int planId, int venueId, int triggeredBy, string remarks)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始触发应急预案，预案ID: {PlanId}，场馆ID: {VenueId}，触发人: {TriggeredBy}",
                planId, venueId, triggeredBy);

            if (planId <= 0)
                throw new ArgumentException("预案ID必须大于0", nameof(planId));
            if (venueId <= 0)
                throw new ArgumentException("场馆ID必须大于0", nameof(venueId));
            if (triggeredBy <= 0)
                throw new ArgumentException("触发人ID必须大于0", nameof(triggeredBy));

            var hasPermission = await _authService.ValidatePermissionAsync(triggeredBy, "Emergency.Trigger");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有触发应急预案的权限");

            var plan = await _context.EmergencyPlans.FindAsync(planId);
            if (plan == null)
            {
                _logger.LogWarning("应急预案不存在，预案ID: {PlanId}", planId);
                throw new InvalidOperationException($"应急预案不存在，预案ID: {planId}");
            }

            var venue = await _context.Venues.FindAsync(venueId);
            if (venue == null)
            {
                _logger.LogWarning("场馆不存在，场馆ID: {VenueId}", venueId);
                throw new InvalidOperationException($"场馆不存在，场馆ID: {venueId}");
            }

            var triggerUser = await _authService.GetCurrentUserAsync(triggeredBy);
            if (triggerUser == null)
            {
                _logger.LogWarning("触发用户不存在，用户ID: {TriggeredBy}", triggeredBy);
                throw new InvalidOperationException($"触发用户不存在，用户ID: {triggeredBy}");
            }

            var activeEmergency = await _context.EmergencyLogs
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.VenueId == venueId && e.Status == "Active");

            if (activeEmergency != null)
            {
                _logger.LogWarning("场馆已有活跃的应急事件，场馆ID: {VenueId}，活跃日志ID: {LogId}",
                    venueId, activeEmergency.Id);
                throw new InvalidOperationException($"场馆 {venue.Name} 已有活跃的应急事件，请先处理完成");
            }

            var emergencyLog = new EmergencyLog
            {
                PlanId = planId,
                VenueId = venueId,
                Status = "Active",
                TriggeredAt = DateTime.UtcNow,
                DetailsJson = Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    triggeredBy = triggeredBy,
                    triggeredByName = triggerUser.FullName,
                    remarks = remarks,
                    planName = plan.Name,
                    planType = plan.Type,
                    steps = Newtonsoft.Json.JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(plan.StepsJson)
                })
            };

            await _context.EmergencyLogs.AddAsync(emergencyLog);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var cacheKeys = new[]
            {
                $"{RedisKeyPrefix.EmergencyLog}active",
                $"{RedisKeyPrefix.EmergencyLog}all"
            };
            foreach (var key in cacheKeys)
            {
                await _redis.KeyDeleteAsync(key);
            }

            var eventData = new
            {
                logId = emergencyLog.Id,
                planId,
                planName = plan.Name,
                planType = plan.Type,
                venueId,
                venueName = venue.Name,
                triggeredBy,
                triggeredByName = triggerUser.FullName,
                remarks,
                triggeredAt = emergencyLog.TriggeredAt,
                status = "Active"
            };

            _ = Task.Run(async () =>
            {
                try
                {
                    var notifyRoles = new[] { "VenueManager", "SecuritySupervisor", "EventCoordinator" };
                    await _notificationService.BroadcastNotificationAsync(
                        notifyRoles,
                        $"【紧急】{plan.Name} 预案已触发",
                        $"场馆 '{venue.Name}' 触发 '{plan.Name}' 应急预案。\n触发人: {triggerUser.FullName}\n备注: {remarks}\n请立即响应！",
                        "urgent");

                    await _redisPublisher.PublishEmergencyUpdateAsync(emergencyLog.Id, eventData);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "发送应急通知失败，日志ID: {LogId}", emergencyLog.Id);
                }
            });

            _logger.LogInformation("应急预案触发成功，日志ID: {LogId}，预案: {PlanName}，场馆: {VenueName}，耗时: {Elapsed}ms",
                emergencyLog.Id, plan.Name, venue.Name, stopwatch.ElapsedMilliseconds);

            return emergencyLog.Id;
        }
        catch (ArgumentException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "触发应急预案失败，预案ID: {PlanId}，场馆ID: {VenueId}", planId, venueId);
            throw new InvalidOperationException("触发应急预案失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步完成应急步骤
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="stepId">步骤ID</param>
    /// <param name="completedBy">完成人ID</param>
    /// <param name="remarks">完成备注</param>
    /// <returns>完成是否成功</returns>
    public async Task<bool> CompleteStepAsync(int logId, int stepId, int completedBy, string remarks)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始完成应急步骤，日志ID: {LogId}，步骤ID: {StepId}，完成人: {CompletedBy}",
                logId, stepId, completedBy);

            if (logId <= 0)
                throw new ArgumentException("日志ID必须大于0", nameof(logId));
            if (stepId <= 0)
                throw new ArgumentException("步骤ID必须大于0", nameof(stepId));
            if (completedBy <= 0)
                throw new ArgumentException("完成人ID必须大于0", nameof(completedBy));

            var hasPermission = await _authService.ValidatePermissionAsync(completedBy, "Emergency.Handle");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有处理应急事件的权限");

            var log = await _context.EmergencyLogs
                .Include(e => e.EmergencyPlan)
                .FirstOrDefaultAsync(e => e.Id == logId);

            if (log == null)
            {
                _logger.LogWarning("应急日志不存在，日志ID: {LogId}", logId);
                return false;
            }

            if (log.Status != "Active")
            {
                _logger.LogWarning("应急事件状态不允许操作，日志ID: {LogId}，状态: {Status}", logId, log.Status);
                throw new InvalidOperationException("只有活跃状态的应急事件可以更新");
            }

            var user = await _authService.GetCurrentUserAsync(completedBy);
            if (user == null)
            {
                _logger.LogWarning("完成用户不存在，用户ID: {CompletedBy}", completedBy);
                throw new InvalidOperationException($"完成用户不存在，用户ID: {completedBy}");
            }

            var details = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(log.DetailsJson);
            if (details == null)
            {
                _logger.LogWarning("应急日志详情解析失败，日志ID: {LogId}", logId);
                return false;
            }

            if (details.TryGetValue("steps", out var stepsObj) &&
                stepsObj is Newtonsoft.Json.Linq.JArray stepsArray)
            {
                var step = stepsArray.FirstOrDefault(s =>
                    s["id"] != null && Convert.ToInt32(s["id"]) == stepId) as Newtonsoft.Json.Linq.JObject;

                if (step != null)
                {
                    step["status"] = "Completed";
                    step["completedAt"] = DateTime.UtcNow;
                    step["completedBy"] = completedBy;
                    step["completedByName"] = user.FullName;
                    step["remarks"] = remarks;

                    log.DetailsJson = Newtonsoft.Json.JsonConvert.SerializeObject(details);
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    var cacheKeys = new[]
                    {
                        $"{RedisKeyPrefix.EmergencyLog}active",
                        $"{RedisKeyPrefix.EmergencyLog}all",
                        $"{RedisKeyPrefix.EmergencyLog}detail:{logId}"
                    };
                    foreach (var key in cacheKeys)
                    {
                        await _redis.KeyDeleteAsync(key);
                    }

                    await _redisPublisher.PublishEmergencyUpdateAsync(logId, new
                    {
                        type = "StepCompleted",
                        logId,
                        stepId,
                        stepName = step["name"]?.ToString() ?? string.Empty,
                        completedBy,
                        completedByName = user.FullName,
                        remarks,
                        timestamp = DateTime.UtcNow
                    });

                    _logger.LogInformation("应急步骤完成成功，日志ID: {LogId}，步骤ID: {StepId}，耗时: {Elapsed}ms",
                        logId, stepId, stopwatch.ElapsedMilliseconds);

                    return true;
                }
            }

            _logger.LogWarning("应急步骤不存在，日志ID: {LogId}，步骤ID: {StepId}", logId, stepId);
            return false;
        }
        catch (ArgumentException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "完成应急步骤失败，日志ID: {LogId}，步骤ID: {StepId}", logId, stepId);
            throw new InvalidOperationException("完成应急步骤失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步解除应急状态
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <param name="resolvedBy">解除人ID</param>
    /// <param name="resolution">解决方案</param>
    /// <returns>解除是否成功</returns>
    public async Task<bool> ResolveEmergencyAsync(int logId, int resolvedBy, string resolution)
    {
        var stopwatch = Stopwatch.StartNew();
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("开始解除应急状态，日志ID: {LogId}，解除人: {ResolvedBy}", logId, resolvedBy);

            if (logId <= 0)
                throw new ArgumentException("日志ID必须大于0", nameof(logId));
            if (resolvedBy <= 0)
                throw new ArgumentException("解除人ID必须大于0", nameof(resolvedBy));
            if (string.IsNullOrWhiteSpace(resolution))
                throw new ArgumentException("解决方案不能为空", nameof(resolution));

            var hasPermission = await _authService.ValidatePermissionAsync(resolvedBy, "Emergency.Resolve");
            if (!hasPermission)
                throw new UnauthorizedAccessException("您没有解除应急状态的权限");

            var log = await _context.EmergencyLogs
                .Include(e => e.EmergencyPlan)
                .Include(e => e.Venue)
                .FirstOrDefaultAsync(e => e.Id == logId);

            if (log == null)
            {
                _logger.LogWarning("应急日志不存在，日志ID: {LogId}", logId);
                return false;
            }

            if (log.Status != "Active")
            {
                _logger.LogWarning("应急事件状态不允许解除，日志ID: {LogId}，状态: {Status}", logId, log.Status);
                throw new InvalidOperationException("只有活跃状态的应急事件可以解除");
            }

            var user = await _authService.GetCurrentUserAsync(resolvedBy);
            if (user == null)
            {
                _logger.LogWarning("解除用户不存在，用户ID: {ResolvedBy}", resolvedBy);
                throw new InvalidOperationException($"解除用户不存在，用户ID: {resolvedBy}");
            }

            var details = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(log.DetailsJson)
                          ?? new Dictionary<string, object>();
            details["resolvedBy"] = resolvedBy;
            details["resolvedByName"] = user.FullName;
            details["resolution"] = resolution;
            details["resolvedAt"] = DateTime.UtcNow;

            log.Status = "Resolved";
            log.ResolvedAt = DateTime.UtcNow;
            log.DetailsJson = Newtonsoft.Json.JsonConvert.SerializeObject(details);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var cacheKeys = new[]
            {
                $"{RedisKeyPrefix.EmergencyLog}active",
                $"{RedisKeyPrefix.EmergencyLog}all",
                $"{RedisKeyPrefix.EmergencyLog}detail:{logId}"
            };
            foreach (var key in cacheKeys)
            {
                await _redis.KeyDeleteAsync(key);
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    var notifyRoles = new[] { "VenueManager", "SecuritySupervisor", "EventCoordinator", "Scheduler" };
                    await _notificationService.BroadcastNotificationAsync(
                        notifyRoles,
                        $"应急解除：{log.EmergencyPlan?.Name} 已处理完成",
                        $"场馆 '{log.Venue?.Name}' 的 '{log.EmergencyPlan?.Name}' 应急事件已解除。\n解除人: {user.FullName}\n解决方案: {resolution}",
                        "high");

                    await _redisPublisher.PublishEmergencyUpdateAsync(logId, new
                    {
                        type = "EmergencyResolved",
                        logId,
                        resolvedBy,
                        resolvedByName = user.FullName,
                        resolution,
                        resolvedAt = log.ResolvedAt,
                        duration = (log.ResolvedAt - log.TriggeredAt)?.TotalMinutes ?? 0
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "发送应急解除通知失败，日志ID: {LogId}", logId);
                }
            });

            _logger.LogInformation("应急状态解除成功，日志ID: {LogId}，持续时间: {Duration}分钟，耗时: {Elapsed}ms",
                logId, (log.ResolvedAt - log.TriggeredAt)?.TotalMinutes ?? 0, stopwatch.ElapsedMilliseconds);

            return true;
        }
        catch (ArgumentException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
            throw;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "解除应急状态失败，日志ID: {LogId}", logId);
            throw new InvalidOperationException("解除应急状态失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步生成处置复盘报告
    /// 支持PDF/Word格式（此处生成CSV格式作为示例）
    /// </summary>
    /// <param name="logId">应急日志ID</param>
    /// <returns>报告文件字节数组</returns>
    public async Task<byte[]> GenerateReportAsync(int logId)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始生成应急处置复盘报告，日志ID: {LogId}", logId);

            if (logId <= 0)
                throw new ArgumentException("日志ID必须大于0", nameof(logId));

            var cacheKey = $"{RedisKeyPrefix.EmergencyLog}detail:{logId}";
            var log = await _context.EmergencyLogs
                .AsNoTracking()
                .Include(e => e.EmergencyPlan)
                .Include(e => e.Venue)
                .FirstOrDefaultAsync(e => e.Id == logId);

            if (log == null)
            {
                _logger.LogWarning("应急日志不存在，日志ID: {LogId}", logId);
                throw new InvalidOperationException($"应急日志不存在，日志ID: {logId}");
            }

            var details = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(log.DetailsJson)
                          ?? new Dictionary<string, object>();

            var reportData = new List<Dictionary<string, object>>
            {
                new()
                {
                    ["项目"] = "应急预案名称",
                    ["内容"] = log.EmergencyPlan?.Name ?? string.Empty
                },
                new()
                {
                    ["项目"] = "应急类型",
                    ["内容"] = log.EmergencyPlan?.Type ?? string.Empty
                },
                new()
                {
                    ["项目"] = "所属场馆",
                    ["内容"] = log.Venue?.Name ?? string.Empty
                },
                new()
                {
                    ["项目"] = "触发时间",
                    ["内容"] = log.TriggeredAt.ToString("yyyy-MM-dd HH:mm:ss")
                },
                new()
                {
                    ["项目"] = "解除时间",
                    ["内容"] = log.ResolvedAt?.ToString("yyyy-MM-dd HH:mm:ss") ?? "未解除"
                },
                new()
                {
                    ["项目"] = "持续时长",
                    ["内容"] = log.ResolvedAt.HasValue
                        ? $"{(int)(log.ResolvedAt.Value - log.TriggeredAt).TotalMinutes}分钟"
                        : "进行中"
                },
                new()
                {
                    ["项目"] = "事件状态",
                    ["内容"] = log.Status
                },
                new()
                {
                    ["项目"] = "触发人",
                    ["内容"] = details.TryGetValue("triggeredByName", out var name) ? name?.ToString() ?? string.Empty : string.Empty
                },
                new()
                {
                    ["项目"] = "触发备注",
                    ["内容"] = details.TryGetValue("remarks", out var remarks) ? remarks?.ToString() ?? string.Empty : string.Empty
                },
                new()
                {
                    ["项目"] = "解除人",
                    ["内容"] = details.TryGetValue("resolvedByName", out var resolvedByName) ? resolvedByName?.ToString() ?? string.Empty : string.Empty
                },
                new()
                {
                    ["项目"] = "解决方案",
                    ["内容"] = details.TryGetValue("resolution", out var resolution) ? resolution?.ToString() ?? string.Empty : string.Empty
                }
            };

            if (details.TryGetValue("steps", out var stepsObj) &&
                stepsObj is Newtonsoft.Json.Linq.JArray stepsArray)
            {
                reportData.Add(new() { ["项目"] = "--- 处理步骤 ---", ["内容"] = "---" });
                foreach (var step in stepsArray)
                {
                    var stepObj = step as Newtonsoft.Json.Linq.JObject;
                    if (stepObj != null)
                    {
                        reportData.Add(new()
                        {
                            ["项目"] = $"步骤{stepObj["id"]}: {stepObj["name"]}",
                            ["内容"] = $"状态: {stepObj["status"]}, 完成人: {stepObj["completedByName"] ?? "-"}"
                        });
                    }
                }
            }

            using var memoryStream = new MemoryStream();
            using var writer = new StreamWriter(memoryStream, new UTF8Encoding(true));
            var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                Delimiter = ",",
                HasHeaderRecord = true
            };
            using var csv = new CsvWriter(writer, csvConfig);

            await csv.WriteRecordsAsync(reportData);
            await writer.FlushAsync();
            var fileBytes = memoryStream.ToArray();

            _logger.LogInformation("应急处置复盘报告生成成功，日志ID: {LogId}，数据行数: {Count}，耗时: {Elapsed}ms",
                logId, reportData.Count, stopwatch.ElapsedMilliseconds);

            return fileBytes;
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "生成应急处置复盘报告失败，日志ID: {LogId}", logId);
            throw new InvalidOperationException("生成应急处置复盘报告失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取当前活跃的应急事件
    /// </summary>
    /// <returns>活跃应急日志列表</returns>
    public async Task<IEnumerable<EmergencyLog>> GetActiveEmergencyAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取当前活跃的应急事件");

            var cacheKey = $"{RedisKeyPrefix.EmergencyLog}active";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (cachedData.HasValue)
            {
                var cachedLogs = Newtonsoft.Json.JsonConvert.DeserializeObject<List<EmergencyLog>>(cachedData!);
                if (cachedLogs != null)
                {
                    _logger.LogInformation("从Redis缓存获取活跃应急事件成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedLogs.Count, stopwatch.ElapsedMilliseconds);
                    return cachedLogs;
                }
            }

            var logs = await _context.EmergencyLogs
                .AsNoTracking()
                .Include(e => e.EmergencyPlan)
                .Include(e => e.Venue)
                .Where(e => e.Status == "Active")
                .OrderByDescending(e => e.TriggeredAt)
                .ToListAsync();

            if (logs.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(logs),
                    TimeSpan.FromMinutes(5));
            }

            _logger.LogInformation("获取当前活跃的应急事件成功，共{Count}条，耗时: {Elapsed}ms",
                logs.Count, stopwatch.ElapsedMilliseconds);

            return logs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取当前活跃的应急事件失败");
            throw new InvalidOperationException("获取当前活跃的应急事件失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    /// <summary>
    /// 异步获取应急日志列表
    /// </summary>
    /// <param name="filter">过滤条件</param>
    /// <returns>应急日志列表</returns>
    public async Task<IEnumerable<EmergencyLog>> GetEmergencyLogsAsync(Dictionary<string, object>? filter = null)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("开始获取应急日志列表");

            var cacheKey = $"{RedisKeyPrefix.EmergencyLog}all";
            var cachedData = await _redis.StringGetAsync(cacheKey);

            if (filter == null && cachedData.HasValue)
            {
                var cachedLogs = Newtonsoft.Json.JsonConvert.DeserializeObject<List<EmergencyLog>>(cachedData!);
                if (cachedLogs != null)
                {
                    _logger.LogInformation("从Redis缓存获取应急日志列表成功，共{Count}条，耗时: {Elapsed}ms",
                        cachedLogs.Count, stopwatch.ElapsedMilliseconds);
                    return cachedLogs;
                }
            }

            var query = _context.EmergencyLogs
                .AsNoTracking()
                .Include(e => e.EmergencyPlan)
                .Include(e => e.Venue)
                .AsQueryable();

            if (filter != null)
            {
                if (filter.TryGetValue("venueId", out var venueIdObj) &&
                    int.TryParse(venueIdObj?.ToString(), out var venueId))
                {
                    query = query.Where(e => e.VenueId == venueId);
                }

                if (filter.TryGetValue("planId", out var planIdObj) &&
                    int.TryParse(planIdObj?.ToString(), out var planId))
                {
                    query = query.Where(e => e.PlanId == planId);
                }

                if (filter.TryGetValue("status", out var statusObj) &&
                    !string.IsNullOrWhiteSpace(statusObj?.ToString()))
                {
                    query = query.Where(e => e.Status == statusObj.ToString());
                }

                if (filter.TryGetValue("startDate", out var startDateObj) &&
                    DateTime.TryParse(startDateObj?.ToString(), out var startDate))
                {
                    query = query.Where(e => e.TriggeredAt >= startDate);
                }

                if (filter.TryGetValue("endDate", out var endDateObj) &&
                    DateTime.TryParse(endDateObj?.ToString(), out var endDate))
                {
                    query = query.Where(e => e.TriggeredAt <= endDate);
                }
            }

            var logs = await query
                .OrderByDescending(e => e.TriggeredAt)
                .ToListAsync();

            if (filter == null && logs.Any())
            {
                await _redis.StringSetAsync(cacheKey,
                    Newtonsoft.Json.JsonConvert.SerializeObject(logs),
                    TimeSpan.FromMinutes(10));
            }

            _logger.LogInformation("获取应急日志列表成功，共{Count}条，耗时: {Elapsed}ms",
                logs.Count, stopwatch.ElapsedMilliseconds);

            return logs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "获取应急日志列表失败");
            throw new InvalidOperationException("获取应急日志列表失败", ex);
        }
        finally
        {
            stopwatch.Stop();
        }
    }
}
