namespace ColdChainMonitor.Domain.Enums;

public enum TransportStatus
{
    Pending = 0,
    InTransit = 1,
    Arrived = 2,
    QualityChecking = 3,
    Completed = 4,
    Cancelled = 5
}

public enum AlertLevel
{
    Info = 0,
    Warning = 1,
    Critical = 2,
    Fatal = 3
}

public enum AlertType
{
    TemperatureHigh = 0,
    TemperatureLow = 1,
    HumidityHigh = 2,
    HumidityLow = 3,
    DeviceOffline = 4,
    DeviceLowBattery = 5,
    DurationExceeded = 6
}

public enum DeviceStatus
{
    Inactive = 0,
    Active = 1,
    Offline = 2,
    LowBattery = 3,
    Faulty = 4
}

public enum UserRole
{
    Dispatcher = 0,
    Driver = 1,
    QualityInspector = 2,
    Admin = 3
}

public enum QualityResult
{
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
    ConditionalAccepted = 3
}

public enum AuditActionType
{
    Create = 0,
    Update = 1,
    Delete = 2,
    StatusChange = 3,
    Login = 4,
    Logout = 5,
    ConfigChange = 6,
    ReportGenerate = 7
}

public enum OperationType
{
    Loading = 0,
    Unloading = 1
}
