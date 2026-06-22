namespace VenueManagementSystem.Common;

/// <summary>
/// 活动类型枚举
/// </summary>
public enum EventType
{
    /// <summary>
    /// 足球比赛
    /// </summary>
    Football,

    /// <summary>
    /// 篮球比赛
    /// </summary>
    Basketball,

    /// <summary>
    /// 游泳比赛
    /// </summary>
    Swimming,

    /// <summary>
    /// 演唱会
    /// </summary>
    Concert,

    /// <summary>
    /// 商务会议
    /// </summary>
    Business,

    /// <summary>
    /// 展览会
    /// </summary>
    Exhibition
}

/// <summary>
/// 活动状态枚举
/// </summary>
public enum EventStatus
{
    /// <summary>
    /// 草稿
    /// </summary>
    Draft,

    /// <summary>
    /// 待审批
    /// </summary>
    PendingApproval,

    /// <summary>
    /// 已批准
    /// </summary>
    Approved,

    /// <summary>
    /// 已排期
    /// </summary>
    Scheduled,

    /// <summary>
    /// 进行中
    /// </summary>
    InProgress,

    /// <summary>
    /// 已完成
    /// </summary>
    Completed,

    /// <summary>
    /// 已取消
    /// </summary>
    Cancelled,

    /// <summary>
    /// 已拒绝
    /// </summary>
    Rejected
}

/// <summary>
/// 资源状态枚举
/// </summary>
public enum ResourceStatus
{
    /// <summary>
    /// 可用
    /// </summary>
    Available,

    /// <summary>
    /// 已占用
    /// </summary>
    Occupied,

    /// <summary>
    /// 维护中
    /// </summary>
    Maintenance,

    /// <summary>
    /// 已预留
    /// </summary>
    Reserved
}

/// <summary>
/// 应急类型枚举
/// </summary>
public enum EmergencyType
{
    /// <summary>
    /// 天气灾害
    /// </summary>
    Weather,

    /// <summary>
    /// 设备故障
    /// </summary>
    Equipment,

    /// <summary>
    /// 安全事件
    /// </summary>
    Security
}

/// <summary>
/// 角色类型枚举
/// </summary>
public enum RoleType
{
    /// <summary>
    /// 场馆经理
    /// </summary>
    VenueManager,

    /// <summary>
    /// 排期员
    /// </summary>
    Scheduler,

    /// <summary>
    /// 活动协调员
    /// </summary>
    EventCoordinator,

    /// <summary>
    /// 票务管理员
    /// </summary>
    TicketAdmin,

    /// <summary>
    /// 安全主管
    /// </summary>
    SecuritySupervisor
}

/// <summary>
/// Redis键前缀常量类
/// 用于统一管理Redis缓存的键前缀
/// </summary>
public static class RedisKeyPrefix
{
    /// <summary>
    /// 场馆缓存前缀
    /// </summary>
    public const string Venue = "venue:";

    /// <summary>
    /// 资源缓存前缀
    /// </summary>
    public const string Resource = "resource:";

    /// <summary>
    /// 活动缓存前缀
    /// </summary>
    public const string Event = "event:";

    /// <summary>
    /// 排期缓存前缀
    /// </summary>
    public const string Schedule = "schedule:";

    /// <summary>
    /// 用户缓存前缀
    /// </summary>
    public const string User = "user:";

    /// <summary>
    /// 票务缓存前缀
    /// </summary>
    public const string Ticket = "ticket:";

    /// <summary>
    /// 设备缓存前缀
    /// </summary>
    public const string Equipment = "equipment:";

    /// <summary>
    /// 锁缓存前缀
    /// </summary>
    public const string Lock = "lock:";

    /// <summary>
    /// 通知缓存前缀
    /// </summary>
    public const string Notification = "notification:";

    /// <summary>
    /// 应急预案缓存前缀
    /// </summary>
    public const string EmergencyPlan = "emergency:plan:";

    /// <summary>
    /// 应急日志缓存前缀
    /// </summary>
    public const string EmergencyLog = "emergency:log:";

    /// <summary>
    /// 消息频道前缀
    /// </summary>
    public const string Channel = "channel:";
}
