package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.dto.OrderCreateDTO;
import com.freshcommunity.entity.Order;
import com.freshcommunity.entity.OrderItem;
import com.freshcommunity.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/order")
public class OrderController {

    @Autowired
    private OrderService orderService;

    @GetMapping("/page")
    public Result<PageResult<Order>> getOrderPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String orderNo,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long communityId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        Page<Order> page = orderService.getOrderPage(pageNum, pageSize, orderNo, userId, communityId, status, startDate, endDate);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> getOrderDetail(@PathVariable Long id) {
        Order order = orderService.getById(id);
        List<OrderItem> items = orderService.getOrderItems(id);
        Map<String, Object> detail = new HashMap<>();
        detail.put("order", order);
        detail.put("items", items);
        return Result.success(detail);
    }

    @GetMapping("/{id}/items")
    public Result<List<OrderItem>> getOrderItems(@PathVariable Long id) {
        List<OrderItem> items = orderService.getOrderItems(id);
        return Result.success(items);
    }

    @GetMapping("/pending-delivery")
    public Result<List<Order>> getPendingDeliveryOrders(@RequestParam(required = false) Long communityId) {
        List<Order> list = orderService.getPendingDeliveryOrders(communityId);
        return Result.success(list);
    }

    @PostMapping("/create")
    public Result<Order> createOrder(@RequestBody OrderCreateDTO dto) {
        try {
            Order order = orderService.createOrder(dto);
            return Result.success("订单创建成功", order);
        } catch (RuntimeException e) {
            return Result.error(e.getMessage());
        }
    }

    @PutMapping("/{id}/pay")
    public Result<Void> payOrder(@PathVariable Long id) {
        boolean success = orderService.payOrder(id);
        return success ? Result.success("支付成功") : Result.error("支付失败");
    }

    @PutMapping("/{id}/cancel")
    public Result<Void> cancelOrder(@PathVariable Long id, @RequestParam(required = false) String reason) {
        boolean success = orderService.cancelOrder(id, reason);
        return success ? Result.success("取消成功") : Result.error("取消失败");
    }

    @PutMapping("/{id}/refund")
    public Result<Void> applyRefund(@PathVariable Long id, @RequestParam String reason) {
        boolean success = orderService.applyRefund(id, reason);
        return success ? Result.success("退款申请已提交") : Result.error("退款申请失败");
    }

    @PutMapping("/{id}/status")
    public Result<Void> updateOrderStatus(@PathVariable Long id, @RequestParam Integer status) {
        boolean success = orderService.updateOrderStatus(id, status);
        return success ? Result.success() : Result.error("状态更新失败");
    }

    @PutMapping("/{id}/delivery-status")
    public Result<Void> updateDeliveryStatus(@PathVariable Long id, @RequestParam Integer deliveryStatus) {
        boolean success = orderService.updateDeliveryStatus(id, deliveryStatus);
        return success ? Result.success() : Result.error("配送状态更新失败");
    }
}
