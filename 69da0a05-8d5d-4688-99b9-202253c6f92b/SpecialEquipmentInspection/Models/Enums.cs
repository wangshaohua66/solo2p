namespace SpecialEquipmentInspection.Models;

public enum DeviceType
{
    Elevator = 1,
    Crane = 2,
    PressureVessel = 3,
    Boiler = 4,
    PassengerRopeway = 5,
    LargeAmusementDevice = 6
}

public enum DeviceStatus
{
    Normal = 1,
    PendingInspection = 2,
    UnderInspection = 3,
    Suspended = 4,
    Scrapped = 5
}

public enum InspectionResult
{
    Pass = 1,
    Fail = 2,
    PassAfterRectification = 3,
    Suspended = 4
}

public enum InspectionStatus
{
    Scheduled = 1,
    InProgress = 2,
    Completed = 3,
    Approved = 4
}

public enum RectificationStatus
{
    Pending = 1,
    InProgress = 2,
    Completed = 3,
    Overdue = 4,
    Rejected = 5
}

public enum UserRole
{
    Admin = 1,
    Inspector = 2,
    UserUnit = 3
}

public enum ReportStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4
}

public enum PlanStatus
{
    Draft = 1,
    Published = 2,
    Completed = 3
}

public enum InspectorStatus
{
    Active = 1,
    Expired = 2,
    Revoked = 3
}

public enum SupervisionReportStatus
{
    Pending = 1,
    Reported = 2,
    Failed = 3
}
