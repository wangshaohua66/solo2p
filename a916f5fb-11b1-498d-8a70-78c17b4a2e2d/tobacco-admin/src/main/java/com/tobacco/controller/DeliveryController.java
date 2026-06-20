package com.tobacco.controller;

import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.Result;
import com.tobacco.entity.DeliveryDetail;
import com.tobacco.entity.DeliveryPlan;
import com.tobacco.entity.DeliveryRoute;
import com.tobacco.service.DeliveryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "配送调度", description = "配送计划生成、路线规划、车辆调度等接口")
@RestController
@RequestMapping("/delivery")
@RequiredArgsConstructor
public class DeliveryController {

    private final DeliveryService deliveryService;

    @Operation(summary = "生成配送计划", description = "根据当期订单使用贪心算法规划配送路线，考虑车辆载重和时间窗约束")
    @PostMapping("/plan/generate")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<DeliveryPlan> generateDeliveryPlan(
            @Parameter(description = "订货周期") @RequestParam String orderPeriod) {
        return Result.success(deliveryService.generateDeliveryPlan(orderPeriod));
    }

    @Operation(summary = "获取配送计划详情", description = "根据计划ID获取配送计划详细信息")
    @GetMapping("/plan/{id}")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<DeliveryPlan> getPlanById(
            @Parameter(description = "计划ID") @PathVariable Long id) {
        return Result.success(deliveryService.getPlanById(id));
    }

    @Operation(summary = "根据计划编号查询", description = "通过计划编号查询配送计划")
    @GetMapping("/plan/no/{planNo}")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<DeliveryPlan> getPlanByNo(
            @Parameter(description = "计划编号") @PathVariable String planNo) {
        return Result.success(deliveryService.getPlanByNo(planNo));
    }

    @Operation(summary = "分页查询配送计划", description = "支持按状态、周期、辖区等条件分页查询")
    @GetMapping("/plan/page")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<PageResult<DeliveryPlan>> getPlanPage(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") Integer pageNum,
            @Parameter(description = "每页条数") @RequestParam(defaultValue = "10") Integer pageSize,
            @Parameter(description = "状态") @RequestParam(required = false) Integer status,
            @Parameter(description = "订货周期") @RequestParam(required = false) String orderPeriod,
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId) {
        return Result.success(deliveryService.getPlanPage(pageNum, pageSize, status, orderPeriod, countyId));
    }

    @Operation(summary = "查询配送路线列表", description = "根据配送计划ID查询所有配送路线")
    @GetMapping("/plan/{planId}/routes")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<List<DeliveryRoute>> getRoutesByPlanId(
            @Parameter(description = "计划ID") @PathVariable Long planId) {
        return Result.success(deliveryService.getRoutesByPlanId(planId));
    }

    @Operation(summary = "查询路线配送明细", description = "根据路线ID查询配送点明细和顺序")
    @GetMapping("/route/{routeId}/details")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<List<DeliveryDetail>> getDetailsByRouteId(
            @Parameter(description = "路线ID") @PathVariable Long routeId) {
        return Result.success(deliveryService.getDetailsByRouteId(routeId));
    }

    @Operation(summary = "查询计划所有配送明细", description = "根据计划ID查询所有配送点明细")
    @GetMapping("/plan/{planId}/details")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<List<DeliveryDetail>> getDetailsByPlanId(
            @Parameter(description = "计划ID") @PathVariable Long planId) {
        return Result.success(deliveryService.getDetailsByPlanId(planId));
    }
}
