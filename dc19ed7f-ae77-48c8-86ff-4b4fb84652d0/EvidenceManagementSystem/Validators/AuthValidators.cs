using EvidenceManagementSystem.Models.DTOs;
using FluentValidation;

namespace EvidenceManagementSystem.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("用户名不能为空")
            .Length(3, 50).WithMessage("用户名长度必须在3到50个字符之间");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("密码不能为空")
            .Length(6, 50).WithMessage("密码长度必须在6到50个字符之间");
    }
}

public class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("刷新令牌不能为空");
    }
}

public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("用户名不能为空")
            .Length(3, 50).WithMessage("用户名长度必须在3到50个字符之间");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("密码不能为空")
            .Length(6, 50).WithMessage("密码长度必须在6到50个字符之间");

        RuleFor(x => x.RealName)
            .NotEmpty().WithMessage("真实姓名不能为空")
            .Length(2, 50).WithMessage("真实姓名长度必须在2到50个字符之间");

        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("工号不能为空")
            .Length(2, 50).WithMessage("工号长度必须在2到50个字符之间");

        RuleFor(x => x.Role)
            .InclusiveBetween(1, 4).WithMessage("角色值无效");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("邮箱格式不正确")
            .When(x => !string.IsNullOrEmpty(x.Email));
    }
}
