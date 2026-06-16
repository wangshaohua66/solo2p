using FluentValidation;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Common;

namespace SmartParking.API.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("用户名不能为空")
            .MinimumLength(3).WithMessage("用户名至少3个字符")
            .MaximumLength(50).WithMessage("用户名最多50个字符");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("密码不能为空")
            .MinimumLength(6).WithMessage("密码至少6个字符")
            .MaximumLength(100).WithMessage("密码最多100个字符");
    }
}

public class ParkingEntryRequestValidator : AbstractValidator<ParkingEntryRequest>
{
    public ParkingEntryRequestValidator()
    {
        RuleFor(x => x.SpotId)
            .NotEmpty().WithMessage("车位ID不能为空");

        RuleFor(x => x.PlateNumber)
            .NotEmpty().WithMessage("车牌号不能为空")
            .Matches(@"^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{4,6}[A-HJ-NP-Z0-9挂学警港澳]?$")
            .WithMessage("车牌号格式不正确");
    }
}

public class ParkingExitRequestValidator : AbstractValidator<ParkingExitRequest>
{
    public ParkingExitRequestValidator()
    {
        RuleFor(x => x.RecordId)
            .NotEmpty().WithMessage("记录ID不能为空");
    }
}

public class CreateReservationRequestValidator : AbstractValidator<CreateReservationRequest>
{
    public CreateReservationRequestValidator()
    {
        RuleFor(x => x.StationId)
            .NotEmpty().WithMessage("充电桩ID不能为空");

        RuleFor(x => x.StartTime)
            .NotEmpty().WithMessage("开始时间不能为空");

        RuleFor(x => x.EndTime)
            .NotEmpty().WithMessage("结束时间不能为空")
            .GreaterThan(x => x.StartTime).WithMessage("结束时间必须晚于开始时间");

        RuleFor(x => x)
            .Must(x => (x.EndTime - x.StartTime).TotalMinutes >= 15)
            .WithMessage("预约时长至少15分钟")
            .Must(x => (x.EndTime - x.StartTime).TotalHours <= 24)
            .WithMessage("预约时长不能超过24小时");
    }
}

public class BillingCalculationRequestValidator : AbstractValidator<BillingCalculationRequest>
{
    public BillingCalculationRequestValidator()
    {
        RuleFor(x => x.ExitTime)
            .GreaterThan(x => x.EntryTime).WithMessage("出场时间必须晚于入场时间");

        RuleFor(x => x.PlateNumber)
            .NotEmpty().WithMessage("车牌号不能为空");
    }
}

public class ChargingBillingRequestValidator : AbstractValidator<ChargingBillingRequest>
{
    public ChargingBillingRequestValidator()
    {
        RuleFor(x => x.Kwh)
            .GreaterThan(0).WithMessage("充电量必须大于0");
    }
}

public class CreatePaymentOrderRequestValidator : AbstractValidator<CreatePaymentOrderRequest>
{
    public CreatePaymentOrderRequestValidator()
    {
        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("订单类型不能为空")
            .Must(t => t == "Parking" || t == "Charging" || t == "Reservation")
            .WithMessage("订单类型不正确");

        RuleFor(x => x.RelatedId)
            .NotEmpty().WithMessage("关联ID不能为空");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("金额必须大于0");
    }
}

public class PayOrderRequestValidator : AbstractValidator<PayOrderRequest>
{
    public PayOrderRequestValidator()
    {
        RuleFor(x => x.Method)
            .IsInEnum().WithMessage("支付方式不正确");
    }
}

public class RefundRequestValidator : AbstractValidator<RefundRequest>
{
    public RefundRequestValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty().WithMessage("订单ID不能为空");

        RuleFor(x => x)
            .Must(x => x.FullRefund || (x.RefundAmount.HasValue && x.RefundAmount.Value > 0))
            .WithMessage("部分退款必须指定退款金额");
    }
}

public class CreateWorkOrderRequestValidator : AbstractValidator<CreateWorkOrderRequest>
{
    public CreateWorkOrderRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("标题不能为空")
            .MaximumLength(200).WithMessage("标题最多200个字符");

        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("类型不能为空")
            .Must(t => t == "IllegalParking" || t == "Fault" || t == "Other")
            .WithMessage("工单类型不正确");
    }
}

public class AssignWorkOrderRequestValidator : AbstractValidator<AssignWorkOrderRequest>
{
    public AssignWorkOrderRequestValidator()
    {
        RuleFor(x => x.AssigneeId)
            .NotEmpty().WithMessage("处理人ID不能为空");
    }
}

public class BillingRuleDtoValidator : AbstractValidator<BillingRuleDto>
{
    public BillingRuleDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("规则名称不能为空")
            .MaximumLength(100).WithMessage("规则名称最多100个字符");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("规则类型不正确");

        RuleFor(x => x.Priority)
            .GreaterThan(0).WithMessage("优先级必须大于0");

        RuleForEach(x => x.TimeSlots)
            .SetValidator(new TimeSlotRateDtoValidator());

        RuleForEach(x => x.MemberDiscounts)
            .SetValidator(new MemberDiscountDtoValidator());

        RuleForEach(x => x.ChargingTiers)
            .SetValidator(new ChargingTierDtoValidator());
    }
}

public class TimeSlotRateDtoValidator : AbstractValidator<TimeSlotRateDto>
{
    public TimeSlotRateDtoValidator()
    {
        RuleFor(x => x.StartTime)
            .NotEmpty().WithMessage("开始时间不能为空");

        RuleFor(x => x.EndTime)
            .NotEmpty().WithMessage("结束时间不能为空");

        RuleFor(x => x.RatePerHour)
            .GreaterThanOrEqualTo(0).WithMessage("费率不能为负数");
    }
}

public class MemberDiscountDtoValidator : AbstractValidator<MemberDiscountDto>
{
    public MemberDiscountDtoValidator()
    {
        RuleFor(x => x.Level)
            .GreaterThan(0).WithMessage("会员等级必须大于0");

        RuleFor(x => x.DiscountRate)
            .GreaterThan(0).WithMessage("折扣率必须大于0")
            .LessThanOrEqualTo(1).WithMessage("折扣率不能超过1");
    }
}

public class ChargingTierDtoValidator : AbstractValidator<ChargingTierDto>
{
    public ChargingTierDtoValidator()
    {
        RuleFor(x => x.MinKwh)
            .GreaterThanOrEqualTo(0).WithMessage("起始电量不能为负");

        RuleFor(x => x.RatePerKwh)
            .GreaterThan(0).WithMessage("费率必须大于0");

        RuleFor(x => x)
            .Must(x => !x.MaxKwh.HasValue || x.MaxKwh.Value > x.MinKwh)
            .WithMessage("最大电量必须大于最小电量");
    }
}
