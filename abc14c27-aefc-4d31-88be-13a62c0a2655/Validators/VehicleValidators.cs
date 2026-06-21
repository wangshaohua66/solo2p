using FluentValidation;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;

namespace UsedVehicleTransaction.Validators;

public class VehicleCreateDtoValidator : AbstractValidator<VehicleCreateDto>
{
    public VehicleCreateDtoValidator()
    {
        RuleFor(x => x.Vin)
            .NotEmpty().WithMessage("VIN码不能为空").WithName("Vin is required")
            .Length(17).WithMessage("VIN码必须为17位").WithName("Vin must be 17 characters")
            .Matches("^[A-HJ-NPR-Z0-9]{17}$").WithMessage("VIN码格式无效").WithName("Invalid VIN format");

        RuleFor(x => x.PlateNumber)
            .NotEmpty().WithMessage("车牌号不能为空").WithName("Plate number is required")
            .MaximumLength(20).WithMessage("车牌号长度不能超过20位").WithName("Plate number max length 20");

        RuleFor(x => x.Brand)
            .NotEmpty().WithMessage("品牌不能为空").WithName("Brand is required")
            .MaximumLength(50).WithMessage("品牌长度不能超过50位").WithName("Brand max length 50");

        RuleFor(x => x.Model)
            .NotEmpty().WithMessage("型号不能为空").WithName("Model is required")
            .MaximumLength(50).WithMessage("型号长度不能超过50位").WithName("Model max length 50");

        RuleFor(x => x.ManufactureYear)
            .InclusiveBetween(1980, DateTime.Now.Year + 1)
            .When(x => x.ManufactureYear.HasValue)
            .WithMessage("出厂年份无效").WithName("Invalid manufacture year");

        RuleFor(x => x.ManufactureMonth)
            .InclusiveBetween(1, 12)
            .When(x => x.ManufactureMonth.HasValue)
            .WithMessage("出厂月份无效").WithName("Invalid manufacture month");

        RuleFor(x => x.Mileage)
            .GreaterThanOrEqualTo(0)
            .When(x => x.Mileage.HasValue)
            .WithMessage("里程数不能为负数").WithName("Mileage cannot be negative");

        RuleFor(x => x.Displacement)
            .GreaterThan(0)
            .When(x => x.Displacement.HasValue)
            .WithMessage("排量必须大于0").WithName("Displacement must be positive");

        RuleFor(x => x.Power)
            .GreaterThan(0)
            .When(x => x.Power.HasValue)
            .WithMessage("功率必须大于0").WithName("Power must be positive");

        RuleFor(x => x.EstimatedPrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.EstimatedPrice.HasValue)
            .WithMessage("估价不能为负数").WithName("Estimated price cannot be negative");
    }
}

public class VehicleUpdateDtoValidator : AbstractValidator<VehicleUpdateDto>
{
    public VehicleUpdateDtoValidator()
    {
        RuleFor(x => x.PlateNumber)
            .MaximumLength(20)
            .When(x => !string.IsNullOrEmpty(x.PlateNumber))
            .WithMessage("车牌号长度不能超过20位").WithName("Plate number max length 20");

        RuleFor(x => x.ManufactureYear)
            .InclusiveBetween(1980, DateTime.Now.Year + 1)
            .When(x => x.ManufactureYear.HasValue)
            .WithMessage("出厂年份无效").WithName("Invalid manufacture year");

        RuleFor(x => x.Mileage)
            .GreaterThanOrEqualTo(0)
            .When(x => x.Mileage.HasValue)
            .WithMessage("里程数不能为负数").WithName("Mileage cannot be negative");

        RuleFor(x => x.EstimatedPrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.EstimatedPrice.HasValue)
            .WithMessage("估价不能为负数").WithName("Estimated price cannot be negative");
    }
}

public class VehicleQueryDtoValidator : AbstractValidator<VehicleQueryDto>
{
    public VehicleQueryDtoValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithMessage("页码必须大于0").WithName("Page index must be greater than 0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100).WithMessage("每页数量必须在1-100之间").WithName("Page size must be between 1 and 100");

        RuleFor(x => x.Vin)
            .Length(17)
            .When(x => !string.IsNullOrEmpty(x.Vin))
            .WithMessage("VIN码必须为17位").WithName("Vin must be 17 characters");
    }
}

public class ComplianceCheckRequestDtoValidator : AbstractValidator<ComplianceCheckRequestDto>
{
    public ComplianceCheckRequestDtoValidator()
    {
        RuleFor(x => x.Vin)
            .NotEmpty().WithMessage("VIN码不能为空").WithName("Vin is required")
            .Length(17).WithMessage("VIN码必须为17位").WithName("Vin must be 17 characters")
            .When(x => !x.VehicleId.HasValue);

        RuleFor(x => x.VehicleId)
            .GreaterThan(0).WithMessage("车辆ID无效").WithName("Invalid vehicle ID")
            .When(x => x.VehicleId.HasValue);
    }
}

public class ComplianceReviewDtoValidator : AbstractValidator<ComplianceReviewDto>
{
    public ComplianceReviewDtoValidator()
    {
        RuleFor(x => x.RecordId)
            .GreaterThan(0).WithMessage("审核记录ID无效").WithName("Invalid record ID");

        RuleFor(x => x.Result)
            .IsInEnum().WithMessage("审核结果无效").WithName("Invalid review result");

        RuleFor(x => x.Remark)
            .NotEmpty().WithMessage("审核备注不能为空").WithName("Review remark is required")
            .When(x => x.Result == Enums.ReviewResult.Rejected);
    }
}

public class ComplianceExceptionApprovalDtoValidator : AbstractValidator<ComplianceExceptionApprovalDto>
{
    public ComplianceExceptionApprovalDtoValidator()
    {
        RuleFor(x => x.RecordId)
            .GreaterThan(0).WithMessage("审核记录ID无效").WithName("Invalid record ID");

        RuleFor(x => x.ApprovalRemark)
            .NotEmpty().WithMessage("审批备注不能为空").WithName("Approval remark is required");
    }
}
