using EvidenceManagementSystem.Models.DTOs;
using FluentValidation;

namespace EvidenceManagementSystem.Validators;

public class CreateDestroyRequestRequestValidator : AbstractValidator<CreateDestroyRequestRequest>
{
    public CreateDestroyRequestRequestValidator()
    {
        RuleFor(x => x.EvidenceId)
            .NotEmpty().WithMessage("物证ID不能为空");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("销毁原因不能为空")
            .Length(1, 500).WithMessage("销毁原因长度必须在1到500个字符之间");
    }
}

public class ApproveDestroyRequestValidator : AbstractValidator<ApproveDestroyRequest>
{
    public ApproveDestroyRequestValidator()
    {
        RuleFor(x => x.IsApproved)
            .NotNull().WithMessage("审批结果不能为空");

        RuleFor(x => x.ApprovalOpinion)
            .Length(1, 1000).WithMessage("审批意见长度必须在1到1000个字符之间")
            .When(x => !string.IsNullOrEmpty(x.ApprovalOpinion));
    }
}

public class ExecuteDestroyRequestValidator : AbstractValidator<ExecuteDestroyRequest>
{
    public ExecuteDestroyRequestValidator()
    {
        RuleFor(x => x.Executor1Name)
            .NotEmpty().WithMessage("执行人1不能为空")
            .Length(1, 50).WithMessage("执行人1姓名长度必须在1到50个字符之间");

        RuleFor(x => x.Executor2Name)
            .NotEmpty().WithMessage("执行人2不能为空")
            .Length(1, 50).WithMessage("执行人2姓名长度必须在1到50个字符之间");

        RuleFor(x => x)
            .Must(x => !string.Equals(x.Executor1Name, x.Executor2Name, StringComparison.OrdinalIgnoreCase))
            .WithMessage("两名执行人不能是同一人");
    }
}
