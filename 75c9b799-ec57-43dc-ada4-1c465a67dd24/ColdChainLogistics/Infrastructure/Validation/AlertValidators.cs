using FluentValidation;
using ColdChainLogistics.Models.DTOs;

namespace ColdChainLogistics.Infrastructure.Validation;

public class AlertRuleCreateRequestValidator : AbstractValidator<AlertRuleCreateRequest>
{
    public AlertRuleCreateRequestValidator()
    {
        RuleFor(x => x.RuleName)
            .NotEmpty().WithErrorCode("RULE_NAME_REQUIRED").WithMessage("规则名称不能为空")
            .MaximumLength(200).WithErrorCode("RULE_NAME_TOO_LONG").WithMessage("规则名称长度不能超过200个字符");

        RuleFor(x => x.Severity)
            .IsInEnum().WithErrorCode("SEVERITY_INVALID").WithMessage("无效的严重等级");

        RuleFor(x => x.LogicalOperator)
            .IsInEnum().WithErrorCode("LOGICAL_OPERATOR_INVALID").WithMessage("无效的逻辑运算符");

        RuleFor(x => x.DurationSeconds)
            .GreaterThanOrEqualTo(0).WithErrorCode("DURATION_INVALID").WithMessage("持续时间不能为负数");

        RuleFor(x => x.DetectionMode)
            .IsInEnum().WithErrorCode("DETECTION_MODE_INVALID").WithMessage("无效的检测模式");

        RuleFor(x => x.WindowSizeMinutes)
            .GreaterThan(0).WithErrorCode("WINDOW_SIZE_INVALID").WithMessage("窗口大小必须大于0分钟");

        RuleFor(x => x.Priority)
            .GreaterThan(0).WithErrorCode("PRIORITY_INVALID").WithMessage("优先级必须大于0");

        RuleFor(x => x.Conditions)
            .NotNull().WithErrorCode("CONDITIONS_REQUIRED").WithMessage("规则条件不能为空")
            .Must(x => x.Count > 0).WithErrorCode("CONDITIONS_EMPTY").WithMessage("至少需要一个规则条件");

        RuleForEach(x => x.Conditions).SetValidator(new AlertRuleConditionDtoValidator());
    }
}

public class AlertRuleConditionDtoValidator : AbstractValidator<AlertRuleConditionDto>
{
    public AlertRuleConditionDtoValidator()
    {
        RuleFor(x => x.Metric)
            .NotEmpty().WithErrorCode("METRIC_REQUIRED").WithMessage("指标名称不能为空")
            .MaximumLength(50).WithErrorCode("METRIC_TOO_LONG").WithMessage("指标名称长度不能超过50个字符");

        RuleFor(x => x.Operator)
            .IsInEnum().WithErrorCode("OPERATOR_INVALID").WithMessage("无效的比较运算符");

        RuleFor(x => x.ThresholdValue)
            .NotNull().WithErrorCode("THRESHOLD_REQUIRED").WithMessage("阈值不能为空");

        RuleFor(x => x.ThresholdValue2)
            .NotNull().When(x => x.Operator == 7 || x.Operator == 8)
            .WithErrorCode("THRESHOLD2_REQUIRED").WithMessage("区间比较需要第二个阈值");
    }
}

public class AlertRuleUpdateRequestValidator : AbstractValidator<AlertRuleUpdateRequest>
{
    public AlertRuleUpdateRequestValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithErrorCode("RULE_ID_REQUIRED").WithMessage("规则ID必须大于0");

        RuleFor(x => x.RuleName)
            .NotEmpty().WithErrorCode("RULE_NAME_REQUIRED").WithMessage("规则名称不能为空")
            .MaximumLength(200).WithErrorCode("RULE_NAME_TOO_LONG").WithMessage("规则名称长度不能超过200个字符");
    }
}

public class AlertRuleQueryRequestValidator : AbstractValidator<AlertRuleQueryRequest>
{
    public AlertRuleQueryRequestValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithErrorCode("PAGE_INDEX_INVALID").WithMessage("页码必须大于0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 200).WithErrorCode("PAGE_SIZE_INVALID").WithMessage("每页条数应在1-200之间");
    }
}

public class AlertAcknowledgeRequestValidator : AbstractValidator<AlertAcknowledgeRequest>
{
    public AlertAcknowledgeRequestValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithErrorCode("ALERT_ID_REQUIRED").WithMessage("告警ID必须大于0");
    }
}

public class AlertResolveRequestValidator : AbstractValidator<AlertResolveRequest>
{
    public AlertResolveRequestValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithErrorCode("ALERT_ID_REQUIRED").WithMessage("告警ID必须大于0");

        RuleFor(x => x.ResolutionNotes)
            .NotEmpty().WithErrorCode("RESOLUTION_NOTES_REQUIRED").WithMessage("处理说明不能为空")
            .MaximumLength(2000).WithErrorCode("RESOLUTION_NOTES_TOO_LONG").WithMessage("处理说明长度不能超过2000个字符");
    }
}

public class AlertQueryRequestValidator : AbstractValidator<AlertQueryRequest>
{
    public AlertQueryRequestValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithErrorCode("PAGE_INDEX_INVALID").WithMessage("页码必须大于0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 200).WithErrorCode("PAGE_SIZE_INVALID").WithMessage("每页条数应在1-200之间");
    }
}
