package com.tobacco.controller;

import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.Result;
import com.tobacco.dto.request.OrderCreateRequest;
import com.tobacco.dto.request.OrderQuery;
import com.tobacco.dto.response.QuotaResult;
import com.tobacco.entity.Order;
import com.tobacco.entity.OrderItem;
import com.tobacco.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "订货管理", description = "卷烟订货、配额计算、订单查询等接口")
@RestController
@RequestMapping("/order")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @Operation(summary = "查询订货配额", description = "根据零售户档位、信用等级和历史销量计算本期订货配额上限")
    @GetMapping("/quota/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN')")
    public Result<QuotaResult> getQuota(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(orderService.calculateQuota(retailerId));
    }

    @Operation(summary = "提交订货订单", description = "零售户在配额内提交卷烟订货订单，超配额自动拦截")
    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_RETAILER')")
    public Result<Order> createOrder(@Valid @RequestBody OrderCreateRequest request) {
        return Result.success(orderService.createOrder(request));
    }

    @Operation(summary = "获取订单详情", description = "根据订单ID获取订单详细信息")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<Order> getOrderById(
            @Parameter(description = "订单ID") @PathVariable Long id) {
        return Result.success(orderService.getOrderById(id));
    }

    @Operation(summary = "根据订单号查询", description = "通过订单编号查询订单信息")
    @GetMapping("/no/{orderNo}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<Order> getOrderByNo(
            @Parameter(description = "订单编号") @PathVariable String orderNo) {
        return Result.success(orderService.getOrderByNo(orderNo));
    }

    @Operation(summary = "获取订单明细", description = "获取订单的卷烟明细列表")
    @GetMapping("/{orderId}/items")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<List<OrderItem>> getOrderItems(
            @Parameter(description = "订单ID") @PathVariable Long orderId) {
        return Result.success(orderService.getOrderItems(orderId));
    }

    @Operation(summary = "分页查询订单", description = "支持按状态、零售户、辖区、周期等条件分页查询")
    @GetMapping("/page")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<PageResult<Order>> getOrderPage(OrderQuery query) {
        return Result.success(orderService.getOrderPage(query));
    }

    @Operation(summary = "查询零售户订单列表", description = "根据零售户ID查询所有订单")
    @GetMapping("/retailer/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_RETAILER', 'ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN')")
    public Result<List<Order>> getOrdersByRetailer(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(orderService.getOrdersByRetailer(retailerId));
    }
}
