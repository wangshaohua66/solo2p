using FluentValidation;
using SpecialEquipmentInspection.Dtos;

namespace SpecialEquipmentInspection.Validation;

public class DeviceCodePattern
{
    public const string Pattern = @"^[A-Z]{2}-\d{4}-\d{4}$";
    public const string Message = "设备编码格式应为：两位字母-四位年份-四位序号，如 DT-2026-0001";
}

public class CreateDeviceDtoValidator : AbstractValidator<CreateDeviceDto>
{
    public CreateDeviceDtoValidator()
    {
        RuleFor(x => x.DeviceCode)
            .Matches(DeviceCodePattern.Pattern).WithMessage(DeviceCodePattern.Message);

        RuleFor(x => x.NextInspectionDate)
            .GreaterThan(x => x.ManufacturingDate).WithMessage("下次检验日期必须晚于制造日期")
            .GreaterThan(DateTime.Now.Date).WithMessage("下次检验日期必须为未来日期");

        RuleFor(x => x.UseUnitPhone)
            .Matches(@"^1[3-9]\d{9}$").When(x => !string.IsNullOrWhiteSpace(x.UseUnitPhone))
            .WithMessage("使用单位联系电话格式不正确");

        RuleFor(x => x.TechnicalParameters)
            .Must(BeValidJson).When(x => !string.IsNullOrWhiteSpace(x.TechnicalParameters))
            .WithMessage("技术参数必须为合法JSON");
    }

    private static bool BeValidJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        value = value.Trim();
        if ((!value.StartsWith("{") || !value.EndsWith("}")) && (!value.StartsWith("[") || !value.EndsWith("]")))
            return false;
        try
        {
            System.Text.Json.JsonDocument.Parse(value);
            return true;
        }
        catch
        {
            return false;
        }
    }
}

public class BatchImportDeviceDtoValidator : AbstractValidator<BatchImportDeviceDto>
{
    public BatchImportDeviceDtoValidator()
    {
        RuleFor(x => x.Devices).NotEmpty().WithMessage("导入设备列表不能为空");
        RuleForEach(x => x.Devices).SetValidator(new CreateDeviceDtoValidator());
    }
}
