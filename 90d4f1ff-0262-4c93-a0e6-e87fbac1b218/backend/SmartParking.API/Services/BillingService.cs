using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Models.Entities;
using SmartParking.API.Services.Interfaces;
using SmartParking.API.Hubs;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;

namespace SmartParking.API.Services;

public class BillingService : IBillingService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IDistributedCache _cache;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<BillingService> _logger;
    private readonly IPaymentService _paymentService;

    public BillingService(
        AppDbContext db,
        IMapper mapper,
        IDistributedCache cache,
        IHubContext<NotificationHub> hub,
        ILogger<BillingService> logger,
        IPaymentService paymentService)
    {
        _db = db;
        _mapper = mapper;
        _cache = cache;
        _hub = hub;
        _logger = logger;
        _paymentService = paymentService;
    }

    public async Task<ApiResponse<BillingCalculationDto>> CalculateParkingAsync(BillingCalculationRequest request)
    {
        try
        {
            var calc = new BillingCalculationDto { Details = new List<BillingDetailDto>() };
            var duration = (request.ExitTime - request.EntryTime).TotalMinutes;
            if (duration <= 0) return ApiResponse<BillingCalculationDto>.Success(calc);

            var totalHours = (decimal)Math.Ceiling(duration / 60m);
            calc.BaseAmount = totalHours * 5m;

            var rules = await _db.BillingRules
                .Include(r => r.TimeSlots)
                .Include(r => r.MemberDiscounts)
                .Where(r => r.Type == BillingRuleType.Parking && r.IsEnabled)
                .OrderBy(r => r.Priority)
                .ToListAsync();

            if (!rules.Any())
            {
                calc.ParkingAmount = calc.BaseAmount;
                calc.TotalAmount = calc.ParkingAmount;
                return ApiResponse<BillingCalculationDto>.Success(calc);
            }

            var rule = rules.First();
            var timeSlotAmount = CalculateTimeSlotParking(request.EntryTime, request.ExitTime, rule.TimeSlots);
            calc.ParkingAmount = timeSlotAmount;
            calc.Details.Add(new BillingDetailDto
            {
                Description = $"停车时长 {Math.Round(duration, 0)} 分钟，按时段费率计算",
                Amount = timeSlotAmount,
                Type = "Parking"
            });

            if (request.MemberLevel.HasValue && request.MemberLevel.Value > 0)
            {
                var discount = rule.MemberDiscounts.FirstOrDefault(d => d.Level == request.MemberLevel.Value);
                if (discount != null && discount.DiscountRate < 1.0m)
                {
                    var memberDiscount = calc.ParkingAmount * (1.0m - discount.DiscountRate);
                    calc.MemberDiscount = Math.Round(memberDiscount, 2);
                    calc.Details.Add(new BillingDetailDto
                    {
                        Description = $"会员等级 {request.MemberLevel.Value} 折扣 {Math.Round((1 - discount.DiscountRate) * 100, 0)}%",
                        Amount = -calc.MemberDiscount,
                        Type = "Discount"
                    });
                }
            }

            var beforeCap = calc.ParkingAmount - calc.MemberDiscount;
            if (rule.DailyCap.HasValue && beforeCap > rule.DailyCap.Value)
            {
                calc.DailyCapApplied = true;
                calc.Details.Add(new BillingDetailDto
                {
                    Description = $"触发每日封顶 ¥{rule.DailyCap.Value:F2}",
                    Amount = rule.DailyCap.Value - beforeCap,
                    Type = "DailyCap"
                });
                calc.TotalAmount = Math.Round(rule.DailyCap.Value, 2);
            }
            else
            {
                calc.TotalAmount = Math.Round(beforeCap, 2);
            }

            return ApiResponse<BillingCalculationDto>.Success(calc);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "计算停车费用失败");
            return ApiResponse<BillingCalculationDto>.Error("计算费用失败");
        }
    }

    private decimal CalculateTimeSlotParking(DateTime entry, DateTime exit, ICollection<TimeSlotRate> timeSlots)
    {
        if (!timeSlots.Any()) return 0;

        decimal total = 0;
        var current = entry;

        while (current < exit)
        {
            var hourStart = current.TimeOfDay;
            var nextHour = current.AddHours(1);
            if (nextHour > exit) nextHour = exit;

            var rate = timeSlots.FirstOrDefault(ts =>
            {
                var tsStart = TimeSpan.Parse(ts.StartTime);
                var tsEnd = ts.EndTime == "24:00" ? TimeSpan.FromHours(24) : TimeSpan.Parse(ts.EndTime);
                return hourStart >= tsStart && hourStart < tsEnd;
            })?.RatePerHour ?? 5m;

            var hoursInSlot = (decimal)(nextHour - current).TotalHours;
            total += Math.Ceiling(hoursInSlot) * rate;

            current = nextHour;
        }

        return Math.Round(total, 2);
    }

    public async Task<ApiResponse<BillingCalculationDto>> CalculateChargingAsync(ChargingBillingRequest request)
    {
        try
        {
            var calc = new BillingCalculationDto { Details = new List<BillingDetailDto>() };
            if (request.Kwh <= 0) return ApiResponse<BillingCalculationDto>.Success(calc);

            calc.BaseAmount = request.Kwh * 1.5m;

            var rules = await _db.BillingRules
                .Include(r => r.TimeSlots)
                .Include(r => r.MemberDiscounts)
                .Include(r => r.ChargingTiers)
                .Where(r => r.Type == BillingRuleType.Charging && r.IsEnabled)
                .OrderBy(r => r.Priority)
                .ToListAsync();

            if (!rules.Any())
            {
                calc.ChargingAmount = calc.BaseAmount;
                calc.TotalAmount = calc.ChargingAmount;
                return ApiResponse<BillingCalculationDto>.Success(calc);
            }

            var rule = rules.First();
            var tierAmount = CalculateTierCharging(request.Kwh, rule.ChargingTiers);
            calc.ChargingAmount = tierAmount;
            calc.Details.Add(new BillingDetailDto
            {
                Description = $"充电量 {request.Kwh:F2} kWh，按阶梯计价",
                Amount = tierAmount,
                Type = "Charging"
            });

            if (rule.TimeSlots.Any() && request.StartTime != default)
            {
                var entry = request.StartTime;
                var exit = request.EndTime ?? DateTime.Now;
                var peakPremium = CalculateTimeSlotCharging(entry, exit, rule.TimeSlots, tierAmount);
                if (peakPremium != 0)
                {
                    calc.ChargingAmount = Math.Round(tierAmount + peakPremium, 2);
                    calc.Details.Add(new BillingDetailDto
                    {
                        Description = "时段峰谷加价",
                        Amount = peakPremium,
                        Type = "TimeSlot"
                    });
                }
            }

            if (request.MemberLevel.HasValue && request.MemberLevel.Value > 0)
            {
                var discount = rule.MemberDiscounts.FirstOrDefault(d => d.Level == request.MemberLevel.Value);
                if (discount != null && discount.DiscountRate < 1.0m)
                {
                    calc.MemberDiscount = Math.Round(calc.ChargingAmount * (1.0m - discount.DiscountRate), 2);
                    calc.Details.Add(new BillingDetailDto
                    {
                        Description = $"会员等级 {request.MemberLevel.Value} 折扣",
                        Amount = -calc.MemberDiscount,
                        Type = "Discount"
                    });
                }
            }

            calc.TotalAmount = Math.Round(calc.ChargingAmount - calc.MemberDiscount, 2);

            if (rule.DailyCap.HasValue && calc.TotalAmount > rule.DailyCap.Value)
            {
                calc.DailyCapApplied = true;
                calc.Details.Add(new BillingDetailDto
                {
                    Description = $"触发每日封顶 ¥{rule.DailyCap.Value:F2}",
                    Amount = rule.DailyCap.Value - calc.TotalAmount,
                    Type = "DailyCap"
                });
                calc.TotalAmount = rule.DailyCap.Value;
            }

            return ApiResponse<BillingCalculationDto>.Success(calc);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "计算充电费用失败");
            return ApiResponse<BillingCalculationDto>.Error("计算费用失败");
        }
    }

    private decimal CalculateTierCharging(decimal kwh, ICollection<ChargingTier> tiers)
    {
        if (!tiers.Any()) return Math.Round(kwh * 1.5m, 2);

        decimal total = 0;
        var ordered = tiers.OrderBy(t => t.MinKwh).ToList();

        foreach (var tier in ordered)
        {
            if (kwh <= tier.MinKwh) continue;

            var upper = tier.MaxKwh ?? kwh;
            var inTier = Math.Min(kwh, upper) - tier.MinKwh;
            if (inTier > 0)
            {
                total += inTier * tier.RatePerKwh;
            }
        }

        return Math.Round(total, 2);
    }

    private decimal CalculateTimeSlotCharging(DateTime entry, DateTime exit, ICollection<TimeSlotRate> slots, decimal baseAmount)
    {
        if (!slots.Any()) return 0;
        var avg = slots.Average(s => s.RatePerHour);
        if (avg == 0) return 0;

        var current = entry;
        decimal weightedPremium = 0;
        decimal totalWeight = 0;

        while (current < exit)
        {
            var tsStart = current.TimeOfDay;
            var next = current.AddMinutes(30);
            if (next > exit) next = exit;

            var rate = slots.FirstOrDefault(s =>
            {
                var s = TimeSpan.Parse(s.StartTime);
                var e = s.EndTime == "24:00" ? TimeSpan.FromHours(24) : TimeSpan.Parse(s.EndTime);
                return tsStart >= s && tsStart < e;
            })?.RatePerHour ?? avg;

            var weight = (decimal)(next - current).TotalMinutes;
            weightedPremium += weight * (rate - avg);
            totalWeight += weight;

            current = next;
        }

        if (totalWeight == 0) return 0;
        return Math.Round(baseAmount * (weightedPremium / totalWeight) / avg, 2);
    }

    public async Task<ApiResponse<PaymentOrderDto>> CreateOrderAsync(CreatePaymentOrderRequest request, string userId)
    {
        try
        {
            var order = new PaymentOrder
            {
                OrderNo = GenerateOrderNo(),
                UserId = userId,
                Type = request.Type,
                RelatedId = request.RelatedId,
                Amount = request.Amount,
                Status = OrderStatus.Pending,
                Description = request.Description
            };

            _db.PaymentOrders.Add(order);
            await _db.SaveChangesAsync();

            _logger.LogInformation("创建订单 {OrderNo}，金额 {Amount}", order.OrderNo, order.Amount);
            return ApiResponse<PaymentOrderDto>.Success(_mapper.Map<PaymentOrderDto>(order));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "创建订单失败");
            return ApiResponse<PaymentOrderDto>.Error("创建订单失败");
        }
    }

    public async Task<ApiResponse<PayOrderResponse>> PayOrderAsync(string orderId, PayOrderRequest request, string userId)
    {
        try
        {
            var order = await _db.PaymentOrders.FindAsync(orderId);
            if (order == null || order.UserId != userId)
                return ApiResponse<PayOrderResponse>.Error("订单不存在", 404);

            if (order.Status != OrderStatus.Pending)
                return ApiResponse<PayOrderResponse>.Error("订单状态不正确");

            var orderDto = _mapper.Map<PaymentOrderDto>(order);
            (bool success, string? txnId, string? error) = request.Method switch
            {
                PaymentMethod.WeChat => await _paymentService.ProcessWeChatPayAsync(orderDto),
                PaymentMethod.Alipay => await _paymentService.ProcessAlipayAsync(orderDto),
                PaymentMethod.Balance => await _paymentService.ProcessBalancePayAsync(orderDto, userId),
                _ => (false, null, "不支持的支付方式")
            };

            if (!success)
            {
                _logger.LogWarning("支付失败: {Error}", error);
                return ApiResponse<PayOrderResponse>.Error(error ?? "支付失败");
            }

            order.Status = OrderStatus.Paid;
            order.PaymentMethod = request.Method;
            order.PaidAt = DateTime.UtcNow;
            order.TransactionId = txnId;
            order.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            await _hub.PushPaymentCompleted(userId, orderId);
            _logger.LogInformation("订单 {OrderNo} 支付成功", order.OrderNo);

            return ApiResponse<PayOrderResponse>.Success(new PayOrderResponse());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "支付处理失败");
            return ApiResponse<PayOrderResponse>.Error("支付失败");
        }
    }

    public async Task<ApiResponse> RefundOrderAsync(RefundRequest request, string userId)
    {
        try
        {
            var order = await _db.PaymentOrders.FindAsync(request.OrderId);
            if (order == null || order.UserId != userId)
                return ApiResponse.Error("订单不存在", 404);

            if (order.Status != OrderStatus.Paid)
                return ApiResponse.Error("该订单不可退款");

            var refundAmount = request.FullRefund ? order.Amount : (request.RefundAmount ?? 0);
            if (refundAmount <= 0 || refundAmount > order.Amount)
                return ApiResponse.Error("退款金额不正确");

            order.Status = OrderStatus.Refunding;
            order.RefundAmount = refundAmount;
            order.UpdatedAt = DateTime.UtcNow;

            var (success, error) = await _paymentService.RefundAsync(_mapper.Map<PaymentOrderDto>(order), refundAmount, request.FullRefund);
            if (!success)
            {
                _logger.LogWarning("退款申请失败: {Error}", error);
                order.Status = OrderStatus.Paid;
                await _db.SaveChangesAsync();
                return ApiResponse.Error(error ?? "退款失败");
            }

            order.Status = OrderStatus.Refunded;
            await _db.SaveChangesAsync();

            _logger.LogInformation("订单 {OrderNo} 退款 ¥{Amount} 成功", order.OrderNo, refundAmount);
            return ApiResponse.Ok("退款成功");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "退款失败");
            return ApiResponse.Error("退款失败");
        }
    }

    public async Task<ApiResponse<PagedResult<PaymentOrderDto>>> GetOrdersAsync(PagedQuery query, string? status, string? type, string? userId)
    {
        var q = _db.PaymentOrders.AsNoTracking().AsQueryable();

        if (!string.IsNullOrEmpty(userId))
            q = q.Where(o => o.UserId == userId);
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<OrderStatus>(status, out var s))
            q = q.Where(o => o.Status == s);
        if (!string.IsNullOrEmpty(type))
            q = q.Where(o => o.Type == type);
        if (!string.IsNullOrEmpty(query.Keyword))
            q = q.Where(o => o.OrderNo.Contains(query.Keyword) || (o.Description != null && o.Description.Contains(query.Keyword)));

        q = query.SortDirection == SortDirection.Ascending
            ? q.OrderBy(o => o.CreatedAt)
            : q.OrderByDescending(o => o.CreatedAt);

        var total = await q.CountAsync();
        var items = await q
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return ApiResponse<PagedResult<PaymentOrderDto>>.Success(
            PagedResult<PaymentOrderDto>.Create(_mapper.Map<List<PaymentOrderDto>>(items), total, query.PageIndex, query.PageSize));
    }

    public async Task<ApiResponse<PaymentOrderDto>> GetOrderByIdAsync(string orderId, string userId)
    {
        var order = await _db.PaymentOrders.FindAsync(orderId);
        if (order == null || order.UserId != userId)
            return ApiResponse<PaymentOrderDto>.Error("订单不存在", 404);
        return ApiResponse<PaymentOrderDto>.Success(_mapper.Map<PaymentOrderDto>(order));
    }

    public async Task<ApiResponse<GenerateInvoiceResponse>> GenerateInvoiceAsync(string orderId, string userId)
    {
        var order = await _db.PaymentOrders.FindAsync(orderId);
        if (order == null || order.UserId != userId)
            return ApiResponse<GenerateInvoiceResponse>.Error("订单不存在", 404);
        if (order.Status != OrderStatus.Paid)
            return ApiResponse<GenerateInvoiceResponse>.Error("未支付订单不可开票");

        var invoiceNo = $"INV{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
        return ApiResponse<GenerateInvoiceResponse>.Success(new GenerateInvoiceResponse
        {
            InvoiceNo = invoiceNo,
            InvoiceUrl = $"/api/invoices/{invoiceNo}.pdf"
        });
    }

    public async Task<ApiResponse<List<BillingRuleDto>>> GetRulesAsync()
    {
        var rules = await _db.BillingRules
            .AsNoTracking()
            .Include(r => r.TimeSlots)
            .Include(r => r.MemberDiscounts)
            .Include(r => r.ChargingTiers)
            .OrderBy(r => r.Type).ThenBy(r => r.Priority)
            .ToListAsync();
        return ApiResponse<List<BillingRuleDto>>.Success(_mapper.Map<List<BillingRuleDto>>(rules));
    }

    public async Task<ApiResponse<BillingRuleDto>> CreateRuleAsync(BillingRuleDto request)
    {
        var rule = _mapper.Map<BillingRule>(request);
        rule.Id = Guid.NewGuid().ToString("N");
        _db.BillingRules.Add(rule);
        await _db.SaveChangesAsync();
        return ApiResponse<BillingRuleDto>.Success(_mapper.Map<BillingRuleDto>(rule));
    }

    public async Task<ApiResponse<BillingRuleDto>> UpdateRuleAsync(string ruleId, BillingRuleDto request)
    {
        var rule = await _db.BillingRules
            .Include(r => r.TimeSlots)
            .Include(r => r.MemberDiscounts)
            .Include(r => r.ChargingTiers)
            .FirstOrDefaultAsync(r => r.Id == ruleId);
        if (rule == null) return ApiResponse<BillingRuleDto>.Error("规则不存在", 404);

        rule.Name = request.Name;
        rule.Type = request.Type;
        rule.Priority = request.Priority;
        rule.DailyCap = request.DailyCap;
        rule.IsEnabled = request.IsEnabled;
        rule.UpdatedAt = DateTime.UtcNow;

        if (request.TimeSlots != null)
        {
            _db.TimeSlotRates.RemoveRange(rule.TimeSlots);
            rule.TimeSlots = _mapper.Map<List<TimeSlotRate>>(request.TimeSlots);
        }
        if (request.MemberDiscounts != null)
        {
            _db.MemberDiscounts.RemoveRange(rule.MemberDiscounts);
            rule.MemberDiscounts = _mapper.Map<List<MemberDiscount>>(request.MemberDiscounts);
        }
        if (request.ChargingTiers != null)
        {
            _db.ChargingTiers.RemoveRange(rule.ChargingTiers);
            rule.ChargingTiers = _mapper.Map<List<ChargingTier>>(request.ChargingTiers);
        }

        await _db.SaveChangesAsync();
        return ApiResponse<BillingRuleDto>.Success(_mapper.Map<BillingRuleDto>(rule));
    }

    public async Task<ApiResponse> ToggleRuleAsync(string ruleId, bool isEnabled)
    {
        var rule = await _db.BillingRules.FindAsync(ruleId);
        if (rule == null) return ApiResponse.Error("规则不存在", 404);
        rule.IsEnabled = isEnabled;
        rule.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ApiResponse.Ok();
    }

    private static string GenerateOrderNo()
    {
        return $"ORD{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
    }
}
