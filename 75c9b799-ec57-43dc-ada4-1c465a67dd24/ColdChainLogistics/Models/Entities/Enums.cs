namespace ColdChainLogistics.Models.Entities;

public enum SensorType
{
    Temperature = 1,
    Humidity = 2,
    TemperatureHumidity = 3
}

public enum SensorStatus
{
    Active = 1,
    Offline = 2,
    Maintenance = 3,
    Faulty = 4,
    Decommissioned = 5
}

public enum DataQuality
{
    Normal = 1,
    Suspicious = 2,
    Invalid = 3
}

public enum ShipmentStatus
{
    Created = 1,
    Loading = 2,
    InTransit = 3,
    Arrived = 4,
    Signed = 5,
    Cancelled = 6
}

public enum AlertSeverity
{
    Info = 1,
    Warning = 2,
    Critical = 3,
    Fatal = 4
}

public enum AlertStatus
{
    New = 1,
    Acknowledged = 2,
    Processing = 3,
    Resolved = 4,
    Escalated = 5,
    Closed = 6
}

public enum NotificationChannel
{
    InApp = 1,
    Sms = 2,
    Email = 3
}

public enum RuleConditionOperator
{
    GreaterThan = 1,
    LessThan = 2,
    GreaterThanOrEqual = 3,
    LessThanOrEqual = 4,
    Equal = 5,
    NotEqual = 6,
    Between = 7,
    Outside = 8
}

public enum RuleLogicalOperator
{
    And = 1,
    Or = 2
}

public enum DetectionMode
{
    SuddenChange = 1,
    SustainedDeviation = 2
}

public enum UserRole
{
    DispatchAdmin = 1,
    WarehouseAdmin = 2,
    CustomerQuality = 3,
    SystemAdmin = 4
}
