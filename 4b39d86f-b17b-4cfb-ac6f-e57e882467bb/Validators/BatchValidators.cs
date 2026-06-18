using FluentValidation;
using HazChemSupervision.DTOs;

namespace HazChemSupervision.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("用户名不能为空")
            .Length(3, 50).WithMessage("用户名长度必须在3-50个字符之间");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("密码不能为空")
            .Length(6, 100).WithMessage("密码长度必须在6-100个字符之间");
    }
}

public class ChemicalCreateDtoValidator : AbstractValidator<ChemicalCreateDto>
{
    public ChemicalCreateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("危化品名称不能为空")
            .Length(1, 200).WithMessage("名称长度不能超过200个字符");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("危化品编码不能为空")
            .Length(1, 50).WithMessage("编码长度不能超过50个字符");

        RuleFor(x => x.Category)
            .IsInEnum().WithMessage("危化品类别无效");

        RuleFor(x => x.HazardClass)
            .IsInEnum().WithMessage("危险等级无效");

        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");
    }
}

public class ChemicalUpdateDtoValidator : AbstractValidator<ChemicalUpdateDto>
{
    public ChemicalUpdateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("危化品名称不能为空")
            .Length(1, 200).WithMessage("名称长度不能超过200个字符");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("危化品编码不能为空")
            .Length(1, 50).WithMessage("编码长度不能超过50个字符");

        RuleFor(x => x.Category)
            .IsInEnum().WithMessage("危化品类别无效");

        RuleFor(x => x.HazardClass)
            .IsInEnum().WithMessage("危险等级无效");
    }
}

public class ChemicalBatchCreateDtoValidator : AbstractValidator<ChemicalBatchCreateDto>
{
    public ChemicalBatchCreateDtoValidator()
    {
        RuleFor(x => x.BatchNo)
            .NotEmpty().WithMessage("批次号不能为空")
            .Length(1, 50).WithMessage("批次号长度不能超过50个字符");

        RuleFor(x => x.ChemicalId)
            .GreaterThan(0).WithMessage("危化品ID必须大于0");

        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("数量必须大于0");

        RuleFor(x => x.Unit)
            .NotEmpty().WithMessage("计量单位不能为空")
            .Length(1, 20).WithMessage("计量单位长度不能超过20个字符");

        RuleFor(x => x.ProductionDate)
            .NotEmpty().WithMessage("生产日期不能为空");

        RuleFor(x => x.ExpiryDate)
            .NotEmpty().WithMessage("有效期不能为空")
            .GreaterThan(x => x.ProductionDate).WithMessage("有效期必须晚于生产日期");
    }
}

public class RawMaterialInboundDtoValidator : AbstractValidator<RawMaterialInboundDto>
{
    public RawMaterialInboundDtoValidator()
    {
        RuleFor(x => x.OperatorId)
            .GreaterThan(0).WithMessage("操作人员ID必须大于0");

        RuleFor(x => x.OperatorName)
            .NotEmpty().WithMessage("操作人员姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");

        RuleFor(x => x.WarehouseId)
            .GreaterThan(0).WithMessage("仓库ID必须大于0");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("数量必须大于0");
    }
}

public class ProductionProcessingDtoValidator : AbstractValidator<ProductionProcessingDto>
{
    public ProductionProcessingDtoValidator()
    {
        RuleFor(x => x.OperatorId)
            .GreaterThan(0).WithMessage("操作人员ID必须大于0");

        RuleFor(x => x.OperatorName)
            .NotEmpty().WithMessage("操作人员姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");

        RuleFor(x => x.ProcessRecord)
            .NotEmpty().WithMessage("生产过程记录不能为空")
            .Length(1, 2000).WithMessage("记录长度不能超过2000个字符");

        RuleFor(x => x.StartTime)
            .NotEmpty().WithMessage("开始时间不能为空");

        RuleFor(x => x.EndTime)
            .NotEmpty().WithMessage("结束时间不能为空")
            .GreaterThan(x => x.StartTime).WithMessage("结束时间必须晚于开始时间");
    }
}

public class FinishedInspectionDtoValidator : AbstractValidator<FinishedInspectionDto>
{
    public FinishedInspectionDtoValidator()
    {
        RuleFor(x => x.OperatorId)
            .GreaterThan(0).WithMessage("检验人员ID必须大于0");

        RuleFor(x => x.OperatorName)
            .NotEmpty().WithMessage("检验人员姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");

        RuleFor(x => x.InspectionResult)
            .NotEmpty().WithMessage("检验结果不能为空")
            .Length(1, 2000).WithMessage("检验结果长度不能超过2000个字符");
    }
}

public class OutboundReviewDtoValidator : AbstractValidator<OutboundReviewDto>
{
    public OutboundReviewDtoValidator()
    {
        RuleFor(x => x.OperatorId)
            .GreaterThan(0).WithMessage("复核人员ID必须大于0");

        RuleFor(x => x.OperatorName)
            .NotEmpty().WithMessage("复核人员姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");

        RuleFor(x => x.WarehouseId)
            .GreaterThan(0).WithMessage("仓库ID必须大于0");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("数量必须大于0");
    }
}
