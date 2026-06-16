using Microsoft.EntityFrameworkCore;
using SmartParking.API.Data;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Models.Entities;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class PaymentService : IPaymentService
{
    private readonly AppDbContext _db;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(AppDbContext db, ILogger<PaymentService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<(bool Success, string? TransactionId, string? ErrorMessage)> ProcessWeChatPayAsync(PaymentOrderDto order)
    {
        await Task.Delay(200);
        _logger.LogInformation("模拟微信支付：订单 {OrderNo}，金额 {Amount}", order.OrderNo, order.Amount);
        var success = Random.Shared.Next(0, 100) < 90;
        return success
            ? (true, $"wx_{Guid.NewGuid():N}", null)
            : (false, null, "微信支付处理失败");
    }

    public async Task<(bool Success, string? TransactionId, string? ErrorMessage)> ProcessAlipayAsync(PaymentOrderDto order)
    {
        await Task.Delay(200);
        _logger.LogInformation("模拟支付宝支付：订单 {OrderNo}，金额 {Amount}", order.OrderNo, order.Amount);
        var success = Random.Shared.Next(0, 100) < 90;
        return success
            ? (true, $"ali_{Guid.NewGuid():N}", null)
            : (false, null, "支付宝处理失败");
    }

    public async Task<(bool Success, string? ErrorMessage)> ProcessBalancePayAsync(PaymentOrderDto order, string userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return (false, "用户不存在");

        if (user.Balance < order.Amount)
            return (false, $"余额不足，当前余额 ¥{user.Balance:F2}");

        user.Balance -= order.Amount;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("余额支付：用户 {UserId} 扣款 {Amount}，剩余 {Balance}",
            userId, order.Amount, user.Balance);

        return (true, null);
    }

    public async Task<(bool Success, string? ErrorMessage)> RefundAsync(PaymentOrderDto order, decimal refundAmount, bool fullRefund)
    {
        await Task.Delay(300);

        if (order.PaymentMethod == Common.PaymentMethod.Balance && order.UserId != null)
        {
            var user = await _db.Users.FindAsync(order.UserId);
            if (user != null)
            {
                user.Balance += refundAmount;
                user.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
        }

        _logger.LogInformation("退款处理：订单 {OrderNo}，退款金额 {Amount}，全额退款={Full}",
            order.OrderNo, refundAmount, fullRefund);

        var success = Random.Shared.Next(0, 100) < 95;
        return success ? (true, null) : (false, "第三方退款失败");
    }
}
