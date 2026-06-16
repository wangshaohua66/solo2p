using EvidenceManagementSystem.Models.DTOs;
using FluentValidation;

namespace EvidenceManagementSystem.Validators;

public class CreateInventoryTaskRequestValidator : AbstractValidator<CreateInventoryTaskRequest>
{
    public CreateInventoryTaskRequestValidator()
    {
        RuleFor(x => x.Warehouse)
            .Length(1, 100).WithMessage("库房名称长度必须在1到100个字符之间")
            .When(x => !string.IsNullOrEmpty(x.Warehouse));

        RuleFor(x => x.CaseNumber)
            .Length(1, 50).WithMessage("案件编号长度必须在1到50个字符之间")
            .When(x => !string.IsNullOrEmpty(x.CaseNumber));
    }
}

public class ScanInventoryItemRequestValidator : AbstractValidator<ScanInventoryItemRequest>
{
    public ScanInventoryItemRequestValidator()
    {
        RuleFor(x => x.Barcode)
            .NotEmpty().WithMessage("条码不能为空")
            .Length(1, 50).WithMessage("条码长度必须在1到50个字符之间");
    }
}
