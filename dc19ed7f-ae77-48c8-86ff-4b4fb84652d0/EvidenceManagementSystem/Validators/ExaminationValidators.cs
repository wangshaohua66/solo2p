using EvidenceManagementSystem.Models.DTOs;
using FluentValidation;

namespace EvidenceManagementSystem.Validators;

public class CreateExaminationTaskRequestValidator : AbstractValidator<CreateExaminationTaskRequest>
{
    public CreateExaminationTaskRequestValidator()
    {
        RuleFor(x => x.EvidenceId)
            .NotEmpty().WithMessage("物证ID不能为空");

        RuleFor(x => x.ExaminationType)
            .NotEmpty().WithMessage("鉴定类型不能为空")
            .Length(1, 100).WithMessage("鉴定类型长度必须在1到100个字符之间");

        RuleFor(x => x.ExaminerId)
            .NotEmpty().WithMessage("鉴定人ID不能为空");
    }
}

public class AddExaminationRecordRequestValidator : AbstractValidator<AddExaminationRecordRequest>
{
    public AddExaminationRecordRequestValidator()
    {
        RuleFor(x => x.RoundNumber)
            .GreaterThan(0).WithMessage("轮次必须大于0");

        RuleFor(x => x.RecordContent)
            .NotEmpty().WithMessage("记录内容不能为空");
    }
}

public class SubmitReportRequestValidator : AbstractValidator<SubmitReportRequest>
{
    public SubmitReportRequestValidator()
    {
        RuleFor(x => x.Conclusion)
            .NotEmpty().WithMessage("鉴定结论不能为空");

        RuleFor(x => x.ReportDraft)
            .NotEmpty().WithMessage("报告草稿不能为空");
    }
}

public class ReviewReportRequestValidator : AbstractValidator<ReviewReportRequest>
{
    public ReviewReportRequestValidator()
    {
        RuleFor(x => x.IsApproved)
            .NotNull().WithMessage("审批结果不能为空");

        RuleFor(x => x.RejectReason)
            .NotEmpty().WithMessage("驳回原因为空")
            .When(x => !x.IsApproved);
    }
}
