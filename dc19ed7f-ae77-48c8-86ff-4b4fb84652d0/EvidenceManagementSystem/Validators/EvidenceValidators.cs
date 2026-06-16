using EvidenceManagementSystem.Models.DTOs;
using FluentValidation;

namespace EvidenceManagementSystem.Validators;

public class CreateEvidenceRequestValidator : AbstractValidator<CreateEvidenceRequest>
{
    public CreateEvidenceRequestValidator()
    {
        RuleFor(x => x.Category)
            .IsInEnum().WithMessage("物证类别无效");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("物证名称不能为空")
            .Length(1, 200).WithMessage("物证名称长度必须在1到200个字符之间");

        RuleFor(x => x.ExtractionTime)
            .NotEmpty().WithMessage("提取时间不能为空");

        RuleFor(x => x.ExtractionLocation)
            .NotEmpty().WithMessage("提取地点不能为空")
            .Length(1, 200).WithMessage("提取地点长度必须在1到200个字符之间");

        RuleFor(x => x.ExtractedBy)
            .NotEmpty().WithMessage("提取人不能为空")
            .Length(1, 50).WithMessage("提取人长度必须在1到50个字符之间");

        RuleFor(x => x.PackagingMethod)
            .NotEmpty().WithMessage("包装方式不能为空")
            .Length(1, 200).WithMessage("包装方式长度必须在1到200个字符之间");

        RuleFor(x => x.StorageCondition)
            .IsInEnum().WithMessage("存储条件无效");

        RuleFor(x => x.StorageDaysLimit)
            .GreaterThan(0).WithMessage("保管期限必须大于0天");
    }
}

public class InboundRequestValidator : AbstractValidator<InboundRequest>
{
    public InboundRequestValidator()
    {
        RuleFor(x => x.EvidenceId)
            .NotEmpty().WithMessage("物证ID不能为空");

        RuleFor(x => x.StorageLocation)
            .NotEmpty().WithMessage("存储位置不能为空")
            .Length(1, 100).WithMessage("存储位置长度必须在1到100个字符之间");

        RuleFor(x => x.ShelfNumber)
            .NotEmpty().WithMessage("货架号不能为空")
            .Length(1, 50).WithMessage("货架号长度必须在1到50个字符之间");
    }
}

public class OutboundRequestValidator : AbstractValidator<OutboundRequest>
{
    public OutboundRequestValidator()
    {
        RuleFor(x => x.EvidenceId)
            .NotEmpty().WithMessage("物证ID不能为空");

        RuleFor(x => x.ToDepartment)
            .NotEmpty().WithMessage("接收科室不能为空")
            .Length(1, 100).WithMessage("接收科室长度必须在1到100个字符之间");

        RuleFor(x => x.Receiver)
            .NotEmpty().WithMessage("接收人不能为空")
            .Length(1, 50).WithMessage("接收人长度必须在1到50个字符之间");
    }
}

public class UpdateEvidenceRequestValidator : AbstractValidator<UpdateEvidenceRequest>
{
    public UpdateEvidenceRequestValidator()
    {
        RuleFor(x => x.Name)
            .Length(1, 200).WithMessage("物证名称长度必须在1到200个字符之间")
            .When(x => !string.IsNullOrEmpty(x.Name));

        RuleFor(x => x.StorageLocation)
            .Length(1, 100).WithMessage("存储位置长度必须在1到100个字符之间")
            .When(x => !string.IsNullOrEmpty(x.StorageLocation));

        RuleFor(x => x.ShelfNumber)
            .Length(1, 50).WithMessage("货架号长度必须在1到50个字符之间")
            .When(x => !string.IsNullOrEmpty(x.ShelfNumber));
    }
}
