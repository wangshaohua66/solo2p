using FluentValidation;
using PotteryStudio.Models;

namespace PotteryStudio.Validators;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("用户名不能为空")
            .Length(3, 50).WithMessage("用户名长度必须在3到50个字符之间")
            .Matches("^[a-zA-Z0-9_]+$").WithMessage("用户名只能包含字母、数字和下划线");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("邮箱不能为空")
            .EmailAddress().WithMessage("邮箱格式不正确");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("密码不能为空")
            .MinimumLength(6).WithMessage("密码长度不能少于6个字符")
            .Matches("[A-Z]").WithMessage("密码必须包含至少一个大写字母")
            .Matches("[a-z]").WithMessage("密码必须包含至少一个小写字母")
            .Matches("[0-9]").WithMessage("密码必须包含至少一个数字");

        RuleFor(x => x.Phone)
            .Matches(@"^1[3-9]\d{9}$").When(x => !string.IsNullOrEmpty(x.Phone))
            .WithMessage("手机号格式不正确");
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("用户名不能为空");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("密码不能为空");
    }
}

public class KilnScheduleValidator : AbstractValidator<KilnSchedule>
{
    public KilnScheduleValidator()
    {
        RuleFor(x => x.KilnId)
            .NotEmpty().WithMessage("窑炉不能为空");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("标题不能为空")
            .MaximumLength(100).WithMessage("标题不能超过100个字符");

        RuleFor(x => x.StartTime)
            .NotEmpty().WithMessage("开始时间不能为空");

        RuleFor(x => x.EndTime)
            .NotEmpty().WithMessage("结束时间不能为空")
            .GreaterThan(x => x.StartTime).WithMessage("结束时间必须晚于开始时间");

        RuleFor(x => x.FiringType)
            .IsInEnum().WithMessage("烧制类型不正确");
    }
}

public class GlazeRecipeValidator : AbstractValidator<GlazeRecipe>
{
    public GlazeRecipeValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("配方名称不能为空")
            .MaximumLength(100).WithMessage("名称不能超过100个字符");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("配方代码不能为空")
            .MaximumLength(50).WithMessage("代码不能超过50个字符");

        RuleFor(x => x.FiringType)
            .IsInEnum().WithMessage("烧制类型不正确");

        RuleFor(x => x.TemperatureMin)
            .GreaterThan(0).WithMessage("最低温度必须大于0");

        RuleFor(x => x.TemperatureMax)
            .GreaterThan(x => x.TemperatureMin).WithMessage("最高温度必须大于最低温度");

        RuleFor(x => x.Ingredients)
            .Must(x => x != null && x.Count > 0).WithMessage("至少需要一种成分")
            .Must(x => x.Sum(i => i.Percentage) == 100).When(x => x != null && x.Count > 0)
            .WithMessage("成分百分比总和必须等于100%");
    }
}

public class PieceArchiveValidator : AbstractValidator<PieceArchive>
{
    public PieceArchiveValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("作品标题不能为空")
            .MaximumLength(200).WithMessage("标题不能超过200个字符");

        RuleFor(x => x.MemberId)
            .NotEmpty().WithMessage("作者不能为空");

        RuleFor(x => x.Weight)
            .GreaterThan(0).When(x => x.Weight.HasValue)
            .WithMessage("重量必须大于0");
    }
}

public class CourseValidator : AbstractValidator<Course>
{
    public CourseValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("课程标题不能为空")
            .MaximumLength(200).WithMessage("标题不能超过200个字符");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("课程类型不正确");

        RuleFor(x => x.Level)
            .IsInEnum().WithMessage("难度等级不正确");

        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0).WithMessage("价格不能为负数");

        RuleFor(x => x.MaxStudents)
            .GreaterThan(0).WithMessage("最大人数必须大于0");

        RuleFor(x => x.Duration)
            .GreaterThan(0).WithMessage("课程时长必须大于0");
    }
}

public class MaterialValidator : AbstractValidator<Material>
{
    public MaterialValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("原料名称不能为空")
            .MaximumLength(100).WithMessage("名称不能超过100个字符");

        RuleFor(x => x.Category)
            .IsInEnum().WithMessage("分类不正确");

        RuleFor(x => x.TotalQuantity)
            .GreaterThanOrEqualTo(0).WithMessage("库存数量不能为负数");

        RuleFor(x => x.MinThreshold)
            .GreaterThanOrEqualTo(0).WithMessage("预警阈值不能为负数");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0).WithMessage("单价不能为负数");
    }
}

public class CustomOrderValidator : AbstractValidator<CustomOrder>
{
    public CustomOrderValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("订单标题不能为空")
            .MaximumLength(200).WithMessage("标题不能超过200个字符");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("需求描述不能为空");

        RuleFor(x => x.ClientName)
            .NotEmpty().WithMessage("客户姓名不能为空")
            .MaximumLength(100).WithMessage("客户姓名不能超过100个字符");

        RuleFor(x => x.ClientContact)
            .NotEmpty().WithMessage("联系方式不能为空");

        RuleFor(x => x.Budget)
            .GreaterThanOrEqualTo(0).When(x => x.Budget.HasValue)
            .WithMessage("预算不能为负数");
    }
}
