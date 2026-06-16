using EvidenceManagementSystem.Models.DTOs;
using FluentValidation;

namespace EvidenceManagementSystem.Validators;

public class SubmitOverdueApprovalRequestValidator : AbstractValidator<SubmitOverdueApprovalRequest>
{
    public SubmitOverdueApprovalRequestValidator()
    {
        RuleFor(x => x.WarningId)
            .NotEmpty().WithMessage("预警ID不能为空");

        RuleFor(x => x.Justification)
            .NotEmpty().WithMessage("延期理由不能为空")
            .Length(1, 500).WithMessage("延期理由长度必须在1到500个字符之间");
    }
}

public class ApproveOverdueRequestValidator : AbstractValidator<ApproveOverdueRequest>
{
    public ApproveOverdueRequestValidator()
    {
        RuleFor(x => x.ApprovalRemark)
            .Length(1, 500).WithMessage("审批意见长度必须在1到500个字符之间")
            .When(x => !string.IsNullOrEmpty(x.ApprovalRemark));
    }
}

public class RejectOverdueRequestValidator : AbstractValidator<RejectOverdueRequest>
{
    public RejectOverdueRequestValidator()
    {
        RuleFor(x => x.RejectReason)
            .NotEmpty().WithMessage("拒绝理由不能为空")
            .Length(1, 500).WithMessage("拒绝理由长度必须在1到500个字符之间");
    }
}
