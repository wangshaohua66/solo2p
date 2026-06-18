package com.insurance.claim.controller;

import com.insurance.claim.common.ApiResponse;
import com.insurance.claim.dto.response.StatisticsResponse;
import com.insurance.claim.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/statistics")
@RequiredArgsConstructor
@Tag(name = "9-统计分析", description = "理赔统计报表、赔付率分析、趋势预测")
public class StatisticsController {

    private final StatisticsService statisticsService;

    @GetMapping("/monthly")
    @Operation(summary = "月度统计", description = "获取指定月份的理赔统计数据")
    public ApiResponse<StatisticsResponse> getMonthlyStatistics(
            @Parameter(description = "年份") @RequestParam Integer year,
            @Parameter(description = "月份") @RequestParam Integer month) {
        StatisticsResponse response = statisticsService.getMonthlyStatistics(year, month);
        return ApiResponse.success(response);
    }

    @GetMapping("/yearly")
    @Operation(summary = "年度统计", description = "获取指定年份的理赔统计数据")
    public ApiResponse<StatisticsResponse> getYearlyStatistics(
            @Parameter(description = "年份") @RequestParam Integer year) {
        StatisticsResponse response = statisticsService.getYearlyStatistics(year);
        return ApiResponse.success(response);
    }

    @GetMapping("/range")
    @Operation(summary = "自定义区间统计", description = "获取指定日期范围内的理赔统计数据")
    public ApiResponse<StatisticsResponse> getDateRangeStatistics(
            @Parameter(description = "开始日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        StatisticsResponse response = statisticsService.getDateRangeStatistics(startDate, endDate);
        return ApiResponse.success(response);
    }

    @GetMapping("/insurance")
    @Operation(summary = "险种维度统计", description = "按险种维度统计理赔数据")
    public ApiResponse<List<StatisticsResponse.InsuranceStatistics>> getInsuranceStatistics(
            @Parameter(description = "开始日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<StatisticsResponse.InsuranceStatistics> result = statisticsService.getInsuranceStatistics(startDate, endDate);
        return ApiResponse.success(result);
    }

    @GetMapping("/branch")
    @Operation(summary = "机构维度统计", description = "按机构维度统计理赔数据")
    public ApiResponse<List<StatisticsResponse.BranchStatistics>> getBranchStatistics(
            @Parameter(description = "开始日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<StatisticsResponse.BranchStatistics> result = statisticsService.getBranchStatistics(startDate, endDate);
        return ApiResponse.success(result);
    }

    @GetMapping("/trend/monthly")
    @Operation(summary = "月度趋势分析", description = "获取按月度的理赔趋势数据")
    public ApiResponse<List<StatisticsResponse.MonthlyTrend>> getMonthlyTrends(
            @Parameter(description = "开始日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<StatisticsResponse.MonthlyTrend> result = statisticsService.getMonthlyTrends(startDate, endDate);
        return ApiResponse.success(result);
    }
}
