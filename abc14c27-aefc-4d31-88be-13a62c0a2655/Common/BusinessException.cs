namespace UsedVehicleTransaction.Common;

public class BusinessException : Exception
{
    public ErrorInfo Error { get; }

    public BusinessException(ErrorInfo error) : base(error.MessageZh)
    {
        Error = error;
    }

    public BusinessException(ErrorInfo error, Exception innerException) : base(error.MessageZh, innerException)
    {
        Error = error;
    }
}
