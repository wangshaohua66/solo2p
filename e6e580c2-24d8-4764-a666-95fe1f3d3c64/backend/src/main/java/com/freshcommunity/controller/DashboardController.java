package com.freshcommunity.controller;

import com.freshcommunity.common.Result;
import com.freshcommunity.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @GetMapping("/overview")
    public Result<Map<String, Object>> getOverviewStatistics() {
        Map<String, Object> stats = dashboardService.getOverviewStatistics();
        return Result.success(stats);
    }

    @GetMapping("/sales-trend")
    public Result<Map<String, Object>> getSalesTrend(
            @RequestParam(defaultValue = "day") String dimension,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        Map<String, Object> trend = dashboardService.getSalesTrend(dimension, startDate, endDate);
        return Result.success(trend);
    }

    @GetMapping("/top-products")
    public Result<Map<String, Object>> getTopSellingProducts(@RequestParam(defaultValue = "50") int limit) {
        Map<String, Object> result = dashboardService.getTopSellingProducts(limit);
        return Result.success(result);
    }

    @GetMapping("/community-comparison")
    public Result<Map<String, Object>> getCommunitySalesComparison() {
        Map<String, Object> result = dashboardService.getCommunitySalesComparison();
        return Result.success(result);
    }

    @GetMapping("/inventory-warning")
    public Result<Map<String, Object>> getInventoryWarning() {
        Map<String, Object> result = dashboardService.getInventoryWarning();
        return Result.success(result);
    }

    @GetMapping("/category-distribution")
    public Result<Map<String, Object>> getCategoryDistribution() {
        Map<String, Object> result = dashboardService.getCategoryDistribution();
        return Result.success(result);
    }
}
