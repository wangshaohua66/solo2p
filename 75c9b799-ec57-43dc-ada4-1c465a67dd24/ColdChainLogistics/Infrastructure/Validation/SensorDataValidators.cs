using FluentValidation;
using ColdChainLogistics.Models.DTOs;

namespace ColdChainLogistics.Infrastructure.Validation;

public class SensorDataBatchRequestValidator : AbstractValidator<SensorDataBatchRequest>
{
    public SensorDataBatchRequestValidator()
    {
        RuleFor(x => x.VehicleNumber)
            .NotEmpty().WithErrorCode("VEHICLE_NUMBER_REQUIRED").WithMessage("车辆编号不能为空")
            .MaximumLength(50).WithErrorCode("VEHICLE_NUMBER_TOO_LONG").WithMessage("车辆编号长度不能超过50个字符");

        RuleFor(x => x.Data)
            .NotNull().WithErrorCode("DATA_REQUIRED").WithMessage("数据不能为空")
            .Must(x => x.Count > 0 && x.Count <= 20).WithErrorCode("DATA_COUNT_INVALID").WithMessage("每次上报数据条数应在1-20之间");

        RuleForEach(x => x.Data).SetValidator(new SensorDataItemDtoValidator());
    }
}

public class SensorDataItemDtoValidator : AbstractValidator<SensorDataItemDto>
{
    public SensorDataItemDtoValidator()
    {
        RuleFor(x => x.DeviceId)
            .NotEmpty().WithErrorCode("DEVICE_ID_REQUIRED").WithMessage("设备ID不能为空")
            .MaximumLength(100).WithErrorCode("DEVICE_ID_TOO_LONG").WithMessage("设备ID长度不能超过100个字符");

        RuleFor(x => x.Timestamp)
            .NotEmpty().WithErrorCode("TIMESTAMP_REQUIRED").WithMessage("时间戳不能为空")
            .Must(BeReasonableTime).WithErrorCode("TIMESTAMP_INVALID").WithMessage("时间戳不合理");

        RuleFor(x => x.Temperature)
            .InclusiveBetween(-60, 85).WithErrorCode("TEMPERATURE_OUT_OF_RANGE").WithMessage("温度值超出合理范围(-60°C ~ 85°C)");

        RuleFor(x => x.Humidity)
            .InclusiveBetween(0, 100).WithErrorCode("HUMIDITY_OUT_OF_RANGE").WithMessage("湿度值超出合理范围(0% ~ 100%)");

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90).When(x => x.Latitude.HasValue).WithErrorCode("LATITUDE_INVALID").WithMessage("纬度值无效");

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180).When(x => x.Longitude.HasValue).WithErrorCode("LONGITUDE_INVALID").WithMessage("经度值无效");
    }

    private bool BeReasonableTime(DateTime timestamp)
    {
        var now = DateTime.UtcNow;
        return timestamp <= now.AddMinutes(5) && timestamp >= now.AddDays(-7);
    }
}

public class SensorDataQueryRequestValidator : AbstractValidator<SensorDataQueryRequest>
{
    public SensorDataQueryRequestValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithErrorCode("PAGE_INDEX_INVALID").WithMessage("页码必须大于0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 500).WithErrorCode("PAGE_SIZE_INVALID").WithMessage("每页条数应在1-500之间");
    }
}
