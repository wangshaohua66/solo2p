namespace MiningGovApi.Models;

public enum UserRole
{
    MiningApprover = 1,
    SafetyInspector = 2,
    MineManager = 3,
    TradeOfficer = 4
}

public enum MineType
{
    Coal = 1,
    Metal = 2,
    NonMetal = 3,
    SandAndGravel = 4
}

public enum MiningRightStatus
{
    Draft = 0,
    PendingApproval = 1,
    Approved = 2,
    Rejected = 3,
    Active = 4,
    Expired = 5,
    Cancelled = 6,
    Transferred = 7
}

public enum MiningRightChangeType
{
    New = 1,
    Renewal = 2,
    Change = 3,
    Cancellation = 4
}

public enum ApprovalStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public enum AlertLevel
{
    Info = 1,
    Warning = 2,
    Critical = 3
}

public enum AlertStatus
{
    Created = 0,
    Assigned = 1,
    Responded = 2,
    Escalated = 3,
    Closed = 4
}

public enum TradeStatus
{
    Listed = 0,
    Bidding = 1,
    PendingReview = 2,
    Approved = 3,
    Rejected = 4,
    Completed = 5,
    Cancelled = 6
}

public enum SensorType
{
    GasConcentration = 1,
    Temperature = 2,
    Pressure = 3,
    Vibration = 4,
    WaterLevel = 5,
    AirFlow = 6
}

public enum FeeStatus
{
    Pending = 0,
    Billed = 1,
    Paid = 2,
    Overdue = 3
}
