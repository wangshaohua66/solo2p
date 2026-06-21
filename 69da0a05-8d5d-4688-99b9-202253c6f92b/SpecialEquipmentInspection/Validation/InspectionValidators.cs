using FluentValidation;
using SpecialEquipmentInspection.Dtos;

namespace SpecialEquipmentInspection.Validation;

public class CreateInspectionDtoValidator : AbstractValidator<CreateInspectionDto>
{
    public CreateInspectionDtoValidator()
    {
        RuleFor(x => x.ScheduledDate)
            .GreaterThan(DateTime.Now.Date.AddDays(-1)).WithMessage("计划检验日期不能早于今天");
    }
}

public class SubmitInspectionDtoValidator : AbstractValidator<SubmitInspectionDto>
{
    public SubmitInspectionDtoValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("检验项目不能为空");

        RuleFor(x => x.Photos)
            .Must(p => p == null || p.Count <= 20).WithMessage("每次检验照片不能超过20张");

        RuleForEach(x => x.Photos).Must(BeValidPhoto).WithMessage("照片格式不支持或大小超过5MB，支持 data:image/(jpeg|png|webp) 格式");

        RuleFor(x => x.NextInspectionDate)
            .GreaterThan(DateTime.Now.Date).When(x => x.NextInspectionDate.HasValue)
            .WithMessage("下次检验日期必须为未来日期");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ItemCode).NotEmpty();
            item.RuleFor(i => i.ItemName).NotEmpty();
        });
    }

    private const long MaxPhotoBytes = 5L * 1024 * 1024;

    private static bool BeValidPhoto(string? photo)
    {
        if (string.IsNullOrWhiteSpace(photo)) return false;

        if (!photo.StartsWith("data:image/"))
        {
            if (Uri.TryCreate(photo, UriKind.Absolute, out _)) return true;
            return false;
        }

        var commaIndex = photo.IndexOf(',');
        if (commaIndex < 0) return false;

        var mime = photo.Substring(5, commaIndex - 5);
        var slash = mime.IndexOf('/');
        if (slash < 0) return false;
        var format = mime.Substring(0, slash + 1);
        var type = mime.Substring(slash + 1).Split(';')[0];
        if (!new[] { "jpeg", "png", "webp" }.Contains(type)) return false;

        var payload = photo.Substring(commaIndex + 1);
        if (!IsValidBase64(payload)) return false;

        var approxBytes = payload.Length * 3 / 4;
        return approxBytes <= MaxPhotoBytes;
    }

    private static bool IsValidBase64(string s)
    {
        if (string.IsNullOrEmpty(s) || s.Length % 4 != 0) return false;
        foreach (var c in s.TrimEnd('='))
        {
            if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/'))
                return false;
        }
        return true;
    }
}
