namespace SmartParking.API.Common;

public enum UserRole
{
    SuperAdmin = 1,
    ParkOperator = 2,
    ParkingAdmin = 3,
    ChargingOps = 4,
    CarOwner = 5
}

public enum ParkingSpotStatus
{
    Available = 1,
    Occupied = 2,
    Reserved = 3,
    Offline = 4
}

public enum ChargingStationStatus
{
    Idle = 1,
    Charging = 2,
    Reserved = 3,
    Faulty = 4,
    Offline = 5
}

public enum OrderStatus
{
    Pending = 1,
    Paid = 2,
    Refunding = 3,
    Refunded = 4,
    Cancelled = 5
}

public enum WorkOrderStatus
{
    Pending = 1,
    Assigned = 2,
    Processing = 3,
    Closed = 4
}

public enum PaymentMethod
{
    WeChat = 1,
    Alipay = 2,
    Balance = 3
}

public enum ChargingStationType
{
    AC = 1,
    DC = 2
}

public enum BillingRuleType
{
    Parking = 1,
    Charging = 2
}

public enum SortDirection
{
    Ascending = 1,
    Descending = 2
}
