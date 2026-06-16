using FluentValidation;
using ColdChainLogistics.Models.DTOs;

namespace ColdChainLogistics.Infrastructure.Validation;

public class ShipmentCreateRequestValidator : AbstractValidator<ShipmentCreateRequest>
{
    public ShipmentCreateRequestValidator()
    {
        RuleFor(x => x.CustomerId)
            .GreaterThan(0).WithErrorCode("CUSTOMER_ID_REQUIRED").WithMessage("客户ID必须大于0");

        RuleFor(x => x.VehicleId)
            .GreaterThan(0).WithErrorCode("VEHICLE_ID_REQUIRED").WithMessage("车辆ID必须大于0");

        RuleFor(x => x.OriginWarehouseId)
            .GreaterThan(0).WithErrorCode("WAREHOUSE_ID_REQUIRED").WithMessage("仓库ID必须大于0");

        RuleFor(x => x.Destination)
            .MaximumLength(500).WithErrorCode("DESTINATION_TOO_LONG").WithMessage("目的地长度不能超过500个字符");

        RuleFor(x => x.RouteCode)
            .MaximumLength(50).WithErrorCode("ROUTE_CODE_TOO_LONG").WithMessage("线路代码长度不能超过50个字符");

        RuleFor(x => x.DriverName)
            .MaximumLength(50).WithErrorCode("DRIVER_NAME_TOO_LONG").WithMessage("司机姓名长度不能超过50个字符");

        RuleFor(x => x.DriverPhone)
            .MaximumLength(20).WithErrorCode("DRIVER_PHONE_TOO_LONG").WithMessage("司机电话长度不能超过20个字符");

        RuleFor(x => x.Remarks)
            .MaximumLength(1000).WithErrorCode("REMARKS_TOO_LONG").WithMessage("备注长度不能超过1000个字符");

        RuleFor(x => x.TemperatureMin)
            .LessThan(x => x.TemperatureMax).When(x => x.TemperatureMin.HasValue && x.TemperatureMax.HasValue)
            .WithErrorCode("TEMP_RANGE_INVALID").WithMessage("最低温度必须小于最高温度");

        RuleFor(x => x.Batches)
            .Must(x => x != null && x.Count > 0).WithErrorCode("BATCHES_REQUIRED").WithMessage("运输批次不能为空");

        RuleForEach(x => x.Batches).SetValidator(new ShipmentBatchCreateDtoValidator());
    }
}

public class ShipmentBatchCreateDtoValidator : AbstractValidator<ShipmentBatchCreateDto>
{
    public ShipmentBatchCreateDtoValidator()
    {
        RuleFor(x => x.BatchNumber)
            .NotEmpty().WithErrorCode("BATCH_NUMBER_REQUIRED").WithMessage("批次号不能为空")
            .MaximumLength(100).WithErrorCode("BATCH_NUMBER_TOO_LONG").WithMessage("批次号长度不能超过100个字符");

        RuleFor(x => x.ProductName)
            .NotEmpty().WithErrorCode("PRODUCT_NAME_REQUIRED").WithMessage("产品名称不能为空")
            .MaximumLength(200).WithErrorCode("PRODUCT_NAME_TOO_LONG").WithMessage("产品名称长度不能超过200个字符");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithErrorCode("QUANTITY_INVALID").WithMessage("数量必须大于0");

        RuleFor(x => x.Unit)
            .MaximumLength(20).WithErrorCode("UNIT_TOO_LONG").WithMessage("单位长度不能超过20个字符");
    }
}

public class ShipmentUpdateRequestValidator : AbstractValidator<ShipmentUpdateRequest>
{
    public ShipmentUpdateRequestValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithErrorCode("SHIPMENT_ID_REQUIRED").WithMessage("运输单ID必须大于0");

        RuleFor(x => x.Destination)
            .MaximumLength(500).When(x => x.Destination != null)
            .WithErrorCode("DESTINATION_TOO_LONG").WithMessage("目的地长度不能超过500个字符");
    }
}

public class ShipmentStatusUpdateRequestValidator : AbstractValidator<ShipmentStatusUpdateRequest>
{
    public ShipmentStatusUpdateRequestValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithErrorCode("SHIPMENT_ID_REQUIRED").WithMessage("运输单ID必须大于0");

        RuleFor(x => x.Status)
            .IsInEnum().WithErrorCode("STATUS_INVALID").WithMessage("无效的状态值");

        RuleFor(x => x.Remark)
            .MaximumLength(1000).When(x => x.Remark != null)
            .WithErrorCode("REMARK_TOO_LONG").WithMessage("备注长度不能超过1000个字符");
    }
}

public class ShipmentQueryRequestValidator : AbstractValidator<ShipmentQueryRequest>
{
    public ShipmentQueryRequestValidator()
    {
        RuleFor(x => x.PageIndex)
            .GreaterThan(0).WithErrorCode("PAGE_INDEX_INVALID").WithMessage("页码必须大于0");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 200).WithErrorCode("PAGE_SIZE_INVALID").WithMessage("每页条数应在1-200之间");
    }
}
