namespace FireIoTPlatform.Models.Enums;

public enum DeviceType
{
    SmokeDetector = 1,
    TemperatureDetector = 2,
    WaterPressureMonitor = 3,
    HydrantStatusMonitor = 4,
    ElectricalFireMonitor = 5,
    WaterLevelMonitor = 6
}

public enum DeviceStatus
{
    Online = 1,
    Offline = 2,
    Fault = 3,
    Alarm = 4,
    Maintenance = 5
}

public enum AlarmType
{
    SmokeAlarm = 1,
    TemperatureAlarm = 2,
    WaterPressureLow = 3,
    WaterLevelLow = 4,
    DeviceOffline = 5,
    DeviceFault = 6,
    ElectricalFire = 7,
    HydrantAbnormal = 8
}

public enum AlarmLevel
{
    Info = 1,
    Warning = 2,
    Critical = 3,
    Emergency = 4
}

public enum AlarmStatus
{
    Pending = 1,
    Confirmed = 2,
    Processing = 3,
    Resolved = 4,
    FalseAlarm = 5
}

public enum InspectionStatus
{
    Pending = 1,
    InProgress = 2,
    Completed = 3,
    Overdue = 4
}

public enum HazardLevel
{
    General = 1,
    Major = 2,
    Critical = 3
}

public enum HazardStatus
{
    Registered = 1,
    Rectifying = 2,
    Rectified = 3,
    Accepted = 4,
    Overdue = 5
}

public enum DispatchStatus
{
    Created = 1,
    Dispatched = 2,
    EnRoute = 3,
    OnScene = 4,
    Resolved = 5,
    Returned = 6
}

public enum MaintenanceStatus
{
    Active = 1,
    Expiring = 2,
    Expired = 3,
    Terminated = 4
}

public enum UnitType
{
    Commercial = 1,
    Residential = 2,
    Industrial = 3,
    Government = 4,
    Educational = 5,
    Medical = 6,
    Other = 7
}

public enum UserRole
{
    Administrator = 1,
    Supervisor = 2,
    Inspector = 3,
    Firefighter = 4,
    Maintenance = 5,
    UnitAdmin = 6
}
