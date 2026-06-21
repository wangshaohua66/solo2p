using FluentValidation;
using SpecialEquipmentInspection.Dtos;

namespace SpecialEquipmentInspection.Validation;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Username).NotEmpty().WithMessage("用户名不能为空");
        RuleFor(x => x.Password).NotEmpty().WithMessage("密码不能为空")
            .Length(6, 64).WithMessage("密码长度需在6-64位之间");
    }
}

public class CreateInspectorDtoValidator : AbstractValidator<CreateInspectorDto>
{
    public CreateInspectorDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("姓名不能为空");
        RuleFor(x => x.CertificateNo).NotEmpty().WithMessage("证书编号不能为空");

        RuleFor(x => x.CertifiableTypes)
            .NotEmpty().WithMessage("可检验设备类型不能为空")
            .Must(BeValidTypeList).WithMessage("可检验设备类型必须为1-6的数字逗号分隔串，如 1,2,3");

        RuleFor(x => x.ExpiryDate)
            .GreaterThan(x => x.IssueDate).WithMessage("证书到期日期必须晚于发证日期");

        RuleFor(x => x.Phone)
            .Matches(@"^1[3-9]\d{9}$").When(x => !string.IsNullOrWhiteSpace(x.Phone))
            .WithMessage("联系电话格式不正确");
    }

    private static bool BeValidTypeList(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var parts = value.Split(',', StringSplitOptions.RemoveEmptyEntries);
        foreach (var p in parts)
        {
            if (!int.TryParse(p.Trim(), out var t) || t < 1 || t > 6) return false;
        }
        return true;
    }
}
