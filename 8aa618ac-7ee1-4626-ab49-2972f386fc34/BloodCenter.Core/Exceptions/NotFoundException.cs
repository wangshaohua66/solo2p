namespace BloodCenter.Core.Exceptions;

public class NotFoundException : BloodCenterException
{
    public NotFoundException(string entityName, object key)
        : base(ErrorCode.NotFound, $"{entityName} with key '{key}' was not found.")
    {
    }

    public NotFoundException(string message)
        : base(ErrorCode.NotFound, message)
    {
    }
}

public class ValidationException : BloodCenterException
{
    public ValidationException(string message)
        : base(ErrorCode.ValidationError, message)
    {
    }

    public ValidationException(string message, IEnumerable<string> errors)
        : base(ErrorCode.ValidationError, message)
    {
        Errors = errors;
    }

    public IEnumerable<string>? Errors { get; }
}

public class AlreadyExistsException : BloodCenterException
{
    public AlreadyExistsException(string entityName, string fieldName, object value)
        : base(ErrorCode.AlreadyExists, $"{entityName} with {fieldName} '{value}' already exists.")
    {
    }
}

public class UnauthorizedException : BloodCenterException
{
    public UnauthorizedException(string message)
        : base(ErrorCode.Unauthorized, message)
    {
    }
}

public class ForbiddenException : BloodCenterException
{
    public ForbiddenException(string message)
        : base(ErrorCode.Forbidden, message)
    {
    }
}

public class InvalidOperationException : BloodCenterException
{
    public InvalidOperationException(string message)
        : base(ErrorCode.InvalidOperation, message)
    {
    }
}

public class DonorNotEligibleException : BloodCenterException
{
    public DonorNotEligibleException(string message, IEnumerable<string> reasons)
        : base(ErrorCode.DonorNotEligible, message)
    {
        DeferralReasons = reasons;
    }

    public IEnumerable<string> DeferralReasons { get; }
}

public class DonorDeferredException : BloodCenterException
{
    public DonorDeferredException(string message, DateTime? deferralUntil)
        : base(ErrorCode.DonorDeferred, message)
    {
        DeferralUntil = deferralUntil;
    }

    public DateTime? DeferralUntil { get; }
}

public class InitialScreeningFailedException : BloodCenterException
{
    public InitialScreeningFailedException(string reason)
        : base(ErrorCode.InitialScreeningFailed, $"Initial screening failed: {reason}")
    {
        FailureReason = reason;
    }

    public string FailureReason { get; }
}

public class TestNotCompletedException : BloodCenterException
{
    public TestNotCompletedException(Guid donationId)
        : base(ErrorCode.TestNotCompleted, $"Tests for donation {donationId} are not completed.")
    {
    }
}

public class TestPositiveException : BloodCenterException
{
    public TestPositiveException(Guid donationId, string testItem)
        : base(ErrorCode.TestPositive, $"Test for donation {donationId} tested positive for {testItem}.")
    {
    }
}

public class ProductExpiredException : BloodCenterException
{
    public ProductExpiredException(Guid productId, DateTime expiryDate)
        : base(ErrorCode.ProductExpired, $"Product {productId} expired on {expiryDate}.")
    {
    }
}

public class InventoryInsufficientException : BloodCenterException
{
    public InventoryInsufficientException(string productType, int requested, int available)
        : base(ErrorCode.InventoryInsufficient, $"Insufficient inventory for {productType}. Requested: {requested}, Available: {available}")
    {
    }
}

public class ProductReservedException : BloodCenterException
{
    public ProductReservedException(Guid productId)
        : base(ErrorCode.ProductReserved, $"Product {productId} is already reserved.")
    {
    }
}

public class CrossMatchIncompatibleException : BloodCenterException
{
    public CrossMatchIncompatibleException(Guid requestId, Guid productId)
        : base(ErrorCode.CrossMatchIncompatible, $"Cross match incompatible for request {requestId} and product {productId}.")
    {
    }
}

public class ScrapNotApprovedException : BloodCenterException
{
    public ScrapNotApprovedException(Guid scrapId)
        : base(ErrorCode.ScrapNotApproved, $"Scrap record {scrapId} requires approval.")
    {
    }
}

public class InvalidCredentialsException : BloodCenterException
{
    public InvalidCredentialsException()
        : base(ErrorCode.InvalidCredentials, "Invalid username or password.")
    {
    }
}

public class TokenExpiredException : BloodCenterException
{
    public TokenExpiredException()
        : base(ErrorCode.TokenExpired, "Token has expired.")
    {
    }
}

public class InvalidTokenException : BloodCenterException
{
    public InvalidTokenException()
        : base(ErrorCode.InvalidToken, "Invalid token.")
    {
    }
}

public class SecondaryTokenRequiredException : BloodCenterException
{
    public SecondaryTokenRequiredException()
        : base(ErrorCode.SecondaryTokenRequired, "Secondary token required for this operation.")
    {
    }
}
