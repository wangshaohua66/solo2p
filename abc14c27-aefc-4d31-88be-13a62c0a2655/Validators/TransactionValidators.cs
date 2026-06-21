using FluentValidation;
using UsedVehicleTransaction.DTOs;

namespace UsedVehicleTransaction.Validators;

public class InspectionOrderCreateDtoValidator : AbstractValidator<InspectionOrderCreateDto>
{
    public InspectionOrderCreateDtoValidator()
    {
        RuleFor(x => x.VehicleId)
            .GreaterThan(0).WithMessage("车辆ID无效").WithName("Invalid vehicle ID");

        RuleFor(x => x.InspectorId)
            .GreaterThan(0).WithMessage("鉴定师ID无效").WithName("Invalid inspector ID");
    }
}

public class InspectionSubmitDtoValidator : AbstractValidator<InspectionSubmitDto>
{
    public InspectionSubmitDtoValidator()
    {
        RuleFor(x => x.OrderId)
            .GreaterThan(0).WithMessage("工单ID无效").WithName("Invalid order ID");

        RuleFor(x => x.ItemScores)
            .NotEmpty().WithMessage("检测项目评分不能为空").WithName("Item scores are required");

        RuleForEach(x => x.ItemScores).SetValidator(new InspectionItemScoreDtoValidator());
    }
}

public class InspectionItemScoreDtoValidator : AbstractValidator<InspectionItemScoreDto>
{
    public InspectionItemScoreDtoValidator()
    {
        RuleFor(x => x.InspectionItemId)
            .GreaterThan(0).WithMessage("检测项目ID无效").WithName("Invalid inspection item ID");

        RuleFor(x => x.Score)
            .InclusiveBetween(0, 10).WithMessage("评分必须在0-10之间").WithName("Score must be between 0 and 10");

        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("描述长度不能超过1000字符").WithName("Description max length 1000");

        RuleFor(x => x.Finding)
            .MaximumLength(2000).WithMessage("检测结果长度不能超过2000字符").WithName("Finding max length 2000");
    }
}

public class InspectionReviewDtoValidator : AbstractValidator<InspectionReviewDto>
{
    public InspectionReviewDtoValidator()
    {
        RuleFor(x => x.OrderId)
            .GreaterThan(0).WithMessage("工单ID无效").WithName("Invalid order ID");

        RuleFor(x => x.ReviewComment)
            .NotEmpty().WithMessage("审核意见不能为空").WithName("Review comment is required")
            .When(x => !x.Approved);
    }
}

public class InspectionQueryDtoValidator : AbstractValidator<InspectionQueryDto>
{
    public InspectionQueryDtoValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithMessage("页码必须大于0").WithName("Page index must be greater than 0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100).WithMessage("每页数量必须在1-100之间").WithName("Page size must be between 1 and 100");
    }
}

public class TransactionCreateDtoValidator : AbstractValidator<TransactionCreateDto>
{
    public TransactionCreateDtoValidator()
    {
        RuleFor(x => x.VehicleId)
            .GreaterThan(0).WithMessage("车辆ID无效").WithName("Invalid vehicle ID");

        RuleFor(x => x.SellerName)
            .NotEmpty().WithMessage("卖方姓名不能为空").WithName("Seller name is required")
            .MaximumLength(50).WithMessage("卖方姓名长度不能超过50字符").WithName("Seller name max length 50");

        RuleFor(x => x.SellerIdNumber)
            .NotEmpty().WithMessage("卖方身份证号不能为空").WithName("Seller ID number is required")
            .Matches("^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$")
            .WithMessage("卖方身份证号格式无效").WithName("Invalid seller ID format");

        RuleFor(x => x.BuyerName)
            .NotEmpty().WithMessage("买方姓名不能为空").WithName("Buyer name is required")
            .MaximumLength(50).WithMessage("买方姓名长度不能超过50字符").WithName("Buyer name max length 50");

        RuleFor(x => x.BuyerIdNumber)
            .NotEmpty().WithMessage("买方身份证号不能为空").WithName("Buyer ID number is required")
            .Matches("^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$")
            .WithMessage("买方身份证号格式无效").WithName("Invalid buyer ID format");

        RuleFor(x => x.TransactionPrice)
            .GreaterThan(0).WithMessage("交易价格必须大于0").WithName("Transaction price must be greater than 0");

        RuleFor(x => x.TransactionDate)
            .LessThanOrEqualTo(DateTime.Now.AddDays(1))
            .WithMessage("交易日期不能超过明天").WithName("Transaction date cannot be later than tomorrow");
    }
}

public class TransactionQueryDtoValidator : AbstractValidator<TransactionQueryDto>
{
    public TransactionQueryDtoValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithMessage("页码必须大于0").WithName("Page index must be greater than 0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100).WithMessage("每页数量必须在1-100之间").WithName("Page size must be between 1 and 100");
    }
}

public class WorkflowStartDtoValidator : AbstractValidator<WorkflowStartDto>
{
    public WorkflowStartDtoValidator()
    {
        RuleFor(x => x.TransactionId)
            .GreaterThan(0).WithMessage("交易ID无效").WithName("Invalid transaction ID");
    }
}

public class WorkflowNodeProcessDtoValidator : AbstractValidator<WorkflowNodeProcessDto>
{
    public WorkflowNodeProcessDtoValidator()
    {
        RuleFor(x => x.NodeExecutionId)
            .GreaterThan(0).WithMessage("节点执行ID无效").WithName("Invalid node execution ID");

        RuleFor(x => x.ProcessorId)
            .GreaterThan(0).WithMessage("处理人ID无效").WithName("Invalid processor ID");
    }
}

public class WorkflowNodeSkipDtoValidator : AbstractValidator<WorkflowNodeSkipDto>
{
    public WorkflowNodeSkipDtoValidator()
    {
        RuleFor(x => x.NodeExecutionId)
            .GreaterThan(0).WithMessage("节点执行ID无效").WithName("Invalid node execution ID");

        RuleFor(x => x.ProcessorId)
            .GreaterThan(0).WithMessage("处理人ID无效").WithName("Invalid processor ID");

        RuleFor(x => x.SkipReason)
            .NotEmpty().WithMessage("跳过原因不能为空").WithName("Skip reason is required");
    }
}

public class ArchiveSearchDtoValidator : AbstractValidator<ArchiveSearchDto>
{
    public ArchiveSearchDtoValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithMessage("页码必须大于0").WithName("Page index must be greater than 0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100).WithMessage("每页数量必须在1-100之间").WithName("Page size must be between 1 and 100");
    }
}

public class ExceptionCaseCreateDtoValidator : AbstractValidator<ExceptionCaseCreateDto>
{
    public ExceptionCaseCreateDtoValidator()
    {
        RuleFor(x => x.CaseType)
            .IsInEnum().WithMessage("案件类型无效").WithName("Invalid case type");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("案件标题不能为空").WithName("Case title is required")
            .MaximumLength(200).WithMessage("标题长度不能超过200字符").WithName("Title max length 200");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("案件描述不能为空").WithName("Case description is required");

        RuleFor(x => x.Priority)
            .InclusiveBetween(1, 5).WithMessage("优先级必须在1-5之间").WithName("Priority must be between 1 and 5");
    }
}

public class ExceptionCaseProcessDtoValidator : AbstractValidator<ExceptionCaseProcessDto>
{
    public ExceptionCaseProcessDtoValidator()
    {
        RuleFor(x => x.CaseId)
            .GreaterThan(0).WithMessage("案件ID无效").WithName("Invalid case ID");

        RuleFor(x => x.NewStatus)
            .IsInEnum().WithMessage("新状态无效").WithName("Invalid new status");

        RuleFor(x => x.Action)
            .NotEmpty().WithMessage("操作描述不能为空").WithName("Action description is required");
    }
}

public class ExceptionCaseQueryDtoValidator : AbstractValidator<ExceptionCaseQueryDto>
{
    public ExceptionCaseQueryDtoValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithMessage("页码必须大于0").WithName("Page index must be greater than 0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100).WithMessage("每页数量必须在1-100之间").WithName("Page size must be between 1 and 100");
    }
}

public class StatisticsQueryDtoValidator : AbstractValidator<StatisticsQueryDto>
{
    public StatisticsQueryDtoValidator()
    {
        RuleFor(x => x.StartDate)
            .LessThanOrEqualTo(x => x.EndDate)
            .WithMessage("开始日期不能大于结束日期").WithName("Start date cannot be later than end date");

        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("结束日期不能小于开始日期").WithName("End date cannot be earlier than start date");

        RuleFor(x => x.Granularity)
            .Must(x => new[] { "day", "week", "month", "quarter", "year" }.Contains(x.ToLower()))
            .When(x => !string.IsNullOrEmpty(x.Granularity))
            .WithMessage("时间粒度无效").WithName("Invalid granularity");
    }
}
