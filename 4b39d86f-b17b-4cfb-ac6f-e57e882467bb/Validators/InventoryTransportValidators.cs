using FluentValidation;
using HazChemSupervision.DTOs;

namespace HazChemSupervision.Validators;

public class InventoryCreateDtoValidator : AbstractValidator<InventoryCreateDto>
{
    public InventoryCreateDtoValidator()
    {
        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");

        RuleFor(x => x.WarehouseId)
            .GreaterThan(0).WithMessage("仓库ID必须大于0");

        RuleFor(x => x.ChemicalId)
            .GreaterThan(0).WithMessage("危化品ID必须大于0");

        RuleFor(x => x.Quantity)
            .GreaterThanOrEqualTo(0).WithMessage("数量不能小于0");

        RuleFor(x => x.MaxCapacity)
            .GreaterThan(0).WithMessage("最大容量必须大于0");

        RuleFor(x => x.MinSafeQuantity)
            .GreaterThanOrEqualTo(0).WithMessage("最小安全库存不能小于0")
            .LessThan(x => x.MaxCapacity).WithMessage("最小安全库存必须小于最大容量");

        RuleFor(x => x.ReorderLevel)
            .GreaterThanOrEqualTo(0).WithMessage("补货预警线不能小于0");
    }
}

public class InventoryUpdateDtoValidator : AbstractValidator<InventoryUpdateDto>
{
    public InventoryUpdateDtoValidator()
    {
        RuleFor(x => x.Quantity)
            .GreaterThanOrEqualTo(0).WithMessage("数量不能小于0");

        RuleFor(x => x.MaxCapacity)
            .GreaterThan(0).WithMessage("最大容量必须大于0");

        RuleFor(x => x.MinSafeQuantity)
            .GreaterThanOrEqualTo(0).WithMessage("最小安全库存不能小于0")
            .LessThan(x => x.MaxCapacity).WithMessage("最小安全库存必须小于最大容量");

        RuleFor(x => x.ReorderLevel)
            .GreaterThanOrEqualTo(0).WithMessage("补货预警线不能小于0");
    }
}

public class InventoryTransactionCreateDtoValidator : AbstractValidator<InventoryTransactionCreateDto>
{
    public InventoryTransactionCreateDtoValidator()
    {
        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");

        RuleFor(x => x.WarehouseId)
            .GreaterThan(0).WithMessage("仓库ID必须大于0");

        RuleFor(x => x.ChemicalId)
            .GreaterThan(0).WithMessage("危化品ID必须大于0");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("数量必须大于0");

        RuleFor(x => x.Unit)
            .NotEmpty().WithMessage("计量单位不能为空")
            .Length(1, 20).WithMessage("计量单位长度不能超过20个字符");

        RuleFor(x => x.TransactionType)
            .IsInEnum().WithMessage("交易类型无效");

        RuleFor(x => x.OperatorName)
            .NotEmpty().WithMessage("操作人员姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");
    }
}

public class WarehouseCreateDtoValidator : AbstractValidator<WarehouseCreateDto>
{
    public WarehouseCreateDtoValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("仓库编码不能为空")
            .Length(1, 50).WithMessage("编码长度不能超过50个字符");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("仓库名称不能为空")
            .Length(1, 200).WithMessage("名称长度不能超过200个字符");

        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("仓库类型无效");

        RuleFor(x => x.MaxCapacity)
            .GreaterThan(0).WithMessage("最大容量必须大于0");

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("仓库地址不能为空")
            .Length(1, 500).WithMessage("地址长度不能超过500个字符");
    }
}

public class WarehouseUpdateDtoValidator : AbstractValidator<WarehouseUpdateDto>
{
    public WarehouseUpdateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("仓库名称不能为空")
            .Length(1, 200).WithMessage("名称长度不能超过200个字符");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("仓库类型无效");

        RuleFor(x => x.MaxCapacity)
            .GreaterThan(0).WithMessage("最大容量必须大于0");

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("仓库地址不能为空")
            .Length(1, 500).WithMessage("地址长度不能超过500个字符");
    }
}

public class TransportRecordCreateDtoValidator : AbstractValidator<TransportRecordCreateDto>
{
    public TransportRecordCreateDtoValidator()
    {
        RuleFor(x => x.TransportNo)
            .NotEmpty().WithMessage("运输单号不能为空")
            .Length(1, 50).WithMessage("运输单号长度不能超过50个字符");

        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");

        RuleFor(x => x.ChemicalBatchId)
            .GreaterThan(0).WithMessage("批次ID必须大于0");

        RuleFor(x => x.VehiclePlateNo)
            .NotEmpty().WithMessage("车牌号不能为空")
            .Length(1, 20).WithMessage("车牌号长度不能超过20个字符");

        RuleFor(x => x.GpsDeviceId)
            .NotEmpty().WithMessage("GPS设备ID不能为空")
            .Length(1, 50).WithMessage("设备ID长度不能超过50个字符");

        RuleFor(x => x.DriverName)
            .NotEmpty().WithMessage("司机姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");

        RuleFor(x => x.DriverLicenseNo)
            .NotEmpty().WithMessage("驾驶证号不能为空")
            .Length(1, 20).WithMessage("驾驶证号长度不能超过20个字符");

        RuleFor(x => x.StartLocation)
            .NotEmpty().WithMessage("起点不能为空")
            .Length(1, 500).WithMessage("起点长度不能超过500个字符");

        RuleFor(x => x.EndLocation)
            .NotEmpty().WithMessage("终点不能为空")
            .Length(1, 500).WithMessage("终点长度不能超过500个字符");

        RuleFor(x => x.PlannedDepartureTime)
            .NotEmpty().WithMessage("计划出发时间不能为空");
    }
}

public class TransportTrajectoryCreateDtoValidator : AbstractValidator<TransportTrajectoryCreateDto>
{
    public TransportTrajectoryCreateDtoValidator()
    {
        RuleFor(x => x.TransportRecordId)
            .GreaterThan(0).WithMessage("运输记录ID必须大于0");

        RuleFor(x => x.GpsDeviceId)
            .NotEmpty().WithMessage("GPS设备ID不能为空")
            .Length(1, 50).WithMessage("设备ID长度不能超过50个字符");

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180m, 180m).WithMessage("经度必须在-180到180之间");

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90m, 90m).WithMessage("纬度必须在-90到90之间");

        RuleFor(x => x.Speed)
            .GreaterThanOrEqualTo(0).WithMessage("速度不能小于0")
            .LessThanOrEqualTo(200).WithMessage("速度不能超过200km/h");

        RuleFor(x => x.Temperature)
            .InclusiveBetween(-50m, 100m).WithMessage("温度必须在-50到100之间");
    }
}
