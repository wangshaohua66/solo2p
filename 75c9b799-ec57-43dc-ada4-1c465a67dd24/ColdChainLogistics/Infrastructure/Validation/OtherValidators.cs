using FluentValidation;
using ColdChainLogistics.Models.DTOs;

namespace ColdChainLogistics.Infrastructure.Validation;

public class TraceabilityQueryRequestValidator : AbstractValidator<TraceabilityQueryRequest>
{
    public TraceabilityQueryRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.BatchNumber) || x.ShipmentId.HasValue || !string.IsNullOrWhiteSpace(x.ShipmentNumber))
            .WithErrorCode("QUERY_PARAM_REQUIRED").WithMessage("批次号、运输单ID或运输单号至少提供一个");

        RuleFor(x => x.BatchNumber)
            .MaximumLength(100).When(x => !string.IsNullOrWhiteSpace(x.BatchNumber))
            .WithErrorCode("BATCH_NUMBER_TOO_LONG").WithMessage("批次号长度不能超过100个字符");
    }
}

public class ReportGenerateRequestValidator : AbstractValidator<ReportGenerateRequest>
{
    public ReportGenerateRequestValidator()
    {
        RuleFor(x => x.ReportType)
            .NotEmpty().WithErrorCode("REPORT_TYPE_REQUIRED").WithMessage("报告类型不能为空")
            .MaximumLength(50).WithErrorCode("REPORT_TYPE_TOO_LONG").WithMessage("报告类型长度不能超过50个字符");

        RuleFor(x => x.ReportPeriodStart)
            .NotEmpty().WithErrorCode("START_TIME_REQUIRED").WithMessage("报告开始时间不能为空");

        RuleFor(x => x.ReportPeriodEnd)
            .NotEmpty().WithErrorCode("END_TIME_REQUIRED").WithMessage("报告结束时间不能为空");

        RuleFor(x => x.ReportPeriodEnd)
            .GreaterThan(x => x.ReportPeriodStart)
            .WithErrorCode("TIME_RANGE_INVALID").WithMessage("结束时间必须大于开始时间");

        RuleFor(x => x)
            .Must(x => x.CustomerId.HasValue || x.ShipmentId.HasValue)
            .WithErrorCode("SCOPE_REQUIRED").WithMessage("客户ID或运输单ID至少提供一个");
    }
}

public class ReportQueryRequestValidator : AbstractValidator<ReportQueryRequest>
{
    public ReportQueryRequestValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithErrorCode("PAGE_INDEX_INVALID").WithMessage("页码必须大于0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 200).WithErrorCode("PAGE_SIZE_INVALID").WithMessage("每页条数应在1-200之间");
    }
}
