namespace BloodCenter.Core.Exceptions;

public abstract class BloodCenterException : Exception
{
    public int ErrorCode Code { get; }

    protected BloodCenterException(ErrorCode code, string message) : base(message)
    {
        Code = code;
    }

    protected BloodCenterException(ErrorCode code, string message, Exception innerException) : base(message, innerException)
    {
        Code = code;
    }
}

public enum ErrorCode
{
    ValidationError = 1001,
    NotFound = 1002,
    AlreadyExists = 1003,
    Unauthorized = 1004,
    Forbidden = 1005,
    InvalidOperation = 1006,
    DonorNotEligible = 2001,
    DonorDeferred = 2002,
    InitialScreeningFailed = 3001,
    TestNotCompleted = 4001,
    TestPositive = 4002,
    ProductNotFound = 5001,
    ProductExpired = 5002,
    InventoryInsufficient = 5003,
    ProductReserved = 5004,
    CrossMatchIncompatible = 6001,
    RequestNotFound = 6002,
    ScrapNotApproved = 7001,
    InvalidCredentials = 8001,
    TokenExpired = 8002,
    InvalidToken = 8003,
    SecondaryTokenRequired = 8004
}
