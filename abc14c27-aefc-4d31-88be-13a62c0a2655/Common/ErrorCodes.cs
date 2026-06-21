namespace UsedVehicleTransaction.Common;

public class ErrorInfo
{
    public int Code { get; set; }
    public string MessageZh { get; set; } = string.Empty;
    public string MessageEn { get; set; } = string.Empty;
}

public static class ErrorCodes
{
    public static readonly ErrorInfo Success = new() { Code = 0, MessageZh = "操作成功", MessageEn = "Operation succeeded" };

    public static readonly ErrorInfo BadRequest = new() { Code = 40000, MessageZh = "请求参数错误", MessageEn = "Invalid request parameters" };
    public static readonly ErrorInfo Unauthorized = new() { Code = 40100, MessageZh = "未授权访问", MessageEn = "Unauthorized access" };
    public static readonly ErrorInfo Forbidden = new() { Code = 40300, MessageZh = "禁止访问", MessageEn = "Access forbidden" };
    public static readonly ErrorInfo NotFound = new() { Code = 40400, MessageZh = "资源不存在", MessageEn = "Resource not found" };
    public static readonly ErrorInfo InternalServerError = new() { Code = 50000, MessageZh = "服务器内部错误", MessageEn = "Internal server error" };

    public static readonly ErrorInfo VehicleNotFound = new() { Code = 10001, MessageZh = "车辆信息不存在", MessageEn = "Vehicle not found" };
    public static readonly ErrorInfo VinAlreadyExists = new() { Code = 10002, MessageZh = "该VIN码已存在", MessageEn = "VIN already exists" };
    public static readonly ErrorInfo InvalidVin = new() { Code = 10003, MessageZh = "VIN码格式无效", MessageEn = "Invalid VIN format" };

    public static readonly ErrorInfo ComplianceCheckFailed = new() { Code = 20001, MessageZh = "车辆合规校验未通过", MessageEn = "Vehicle compliance check failed" };
    public static readonly ErrorInfo ComplianceCheckTimeout = new() { Code = 20002, MessageZh = "合规校验超时", MessageEn = "Compliance check timed out" };
    public static readonly ErrorInfo ComplianceCheckInProgress = new() { Code = 20003, MessageZh = "合规校验进行中", MessageEn = "Compliance check in progress" };
    public static readonly ErrorInfo ExternalApiError = new() { Code = 20004, MessageZh = "外部接口调用失败", MessageEn = "External API call failed" };

    public static readonly ErrorInfo InspectionNotFound = new() { Code = 30001, MessageZh = "鉴定工单不存在", MessageEn = "Inspection order not found" };
    public static readonly ErrorInfo InspectionInvalidStatus = new() { Code = 30002, MessageZh = "鉴定状态不允许当前操作", MessageEn = "Invalid inspection status for current operation" };
    public static readonly ErrorInfo InspectionItemNotFound = new() { Code = 30003, MessageZh = "检测项目不存在", MessageEn = "Inspection item not found" };
    public static readonly ErrorInfo ReportGenerationFailed = new() { Code = 30004, MessageZh = "鉴定报告生成失败", MessageEn = "Report generation failed" };

    public static readonly ErrorInfo TransactionNotFound = new() { Code = 40001, MessageZh = "交易记录不存在", MessageEn = "Transaction not found" };
    public static readonly ErrorInfo TransactionInvalidStatus = new() { Code = 40002, MessageZh = "交易状态不允许当前操作", MessageEn = "Invalid transaction status for current operation" };
    public static readonly ErrorInfo ArchiveNotFound = new() { Code = 40003, MessageZh = "档案不存在", MessageEn = "Archive not found" };
    public static readonly ErrorInfo FileUploadFailed = new() { Code = 40004, MessageZh = "文件上传失败", MessageEn = "File upload failed" };
    public static readonly ErrorInfo InvalidFileType = new() { Code = 40005, MessageZh = "不支持的文件类型", MessageEn = "Unsupported file type" };
    public static readonly ErrorInfo FileTooLarge = new() { Code = 40006, MessageZh = "文件大小超过限制", MessageEn = "File size exceeds limit" };

    public static readonly ErrorInfo WorkflowNodeNotFound = new() { Code = 50001, MessageZh = "流程节点不存在", MessageEn = "Workflow node not found" };
    public static readonly ErrorInfo WorkflowPrerequisiteNotMet = new() { Code = 50002, MessageZh = "前置条件未满足", MessageEn = "Prerequisites not met" };
    public static readonly ErrorInfo WorkflowInvalidTransition = new() { Code = 50003, MessageZh = "无效的流程跳转", MessageEn = "Invalid workflow transition" };

    public static readonly ErrorInfo ExceptionCaseNotFound = new() { Code = 60001, MessageZh = "异常案件不存在", MessageEn = "Exception case not found" };

    public static ErrorInfo WithDetails(this ErrorInfo baseError, string detailsZh, string detailsEn)
    {
        return new ErrorInfo
        {
            Code = baseError.Code,
            MessageZh = $"{baseError.MessageZh}：{detailsZh}",
            MessageEn = $"{baseError.MessageEn}: {detailsEn}"
        };
    }
}
