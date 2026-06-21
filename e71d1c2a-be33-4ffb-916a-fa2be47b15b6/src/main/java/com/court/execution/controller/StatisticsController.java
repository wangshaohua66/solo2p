package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/statistics")
@Tag(name = "统计报表", description = "按法官、按时间段统计案件、查封、拍卖、款项等数据")
public class StatisticsController {

    private final StatisticsService statisticsService;

    public StatisticsController(StatisticsService statisticsService) {
        this.statisticsService = statisticsService;
    }

    @GetMapping("/overview")
    @Operation(summary = "数据概览", description = "获取系统整体数据概览")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Map<String, Object>> getOverview() {
        Map<String, Object> overview = statisticsService.getOverview();
        return ApiResponse.success(overview);
    }

    @GetMapping("/judge/{judgeId}")
    @Operation(summary = "法官案件统计", description = "按执行法官统计案件数量、结案率、执行到位率")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<Map<String, Object>> getJudgeStatistics(@PathVariable Long judgeId) {
        Map<String, Object> stats = statisticsService.getJudgeStatistics(judgeId);
        return ApiResponse.success(stats);
    }

    @GetMapping("/judge/all")
    @Operation(summary = "所有法官案件统计", description = "统计所有执行法官的案件数量")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Object[]>> getJudgeCaseStatistics() {
        List<Object[]> stats = statisticsService.getJudgeCaseStatistics();
        return ApiResponse.success(stats);
    }

    @GetMapping("/judge/close-rate")
    @Operation(summary = "所有法官结案率统计", description = "统计所有执行法官的结案数量")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Object[]>> getJudgeCloseRateStatistics() {
        List<Object[]> stats = statisticsService.getJudgeCloseRateStatistics();
        return ApiResponse.success(stats);
    }

    @GetMapping("/time-range")
    @Operation(summary = "时间段统计", description = "按时间段统计查封数量、拍卖成交金额、款项发放总额")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<Map<String, Object>> getTimeRangeStatistics(
            @Parameter(description = "开始时间", required = true) @RequestParam LocalDateTime startDate,
            @Parameter(description = "结束时间", required = true) @RequestParam LocalDateTime endDate) {
        Map<String, Object> stats = statisticsService.getTimeRangeStatistics(startDate, endDate);
        return ApiResponse.success(stats);
    }

    @GetMapping("/property/types")
    @Operation(summary = "财产类型统计", description = "按财产类型统计数量")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<Object[]>> getPropertyTypeStatistics() {
        List<Object[]> stats = statisticsService.getPropertyTypeStatistics();
        return ApiResponse.success(stats);
    }

    @GetMapping("/auction")
    @Operation(summary = "拍卖统计", description = "按时间段统计拍卖成交金额和数量")
    @PreAuthorize("hasAnyRole('JUDGE', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Map<String, BigDecimal>> getAuctionStatistics(
            @Parameter(description = "开始时间", required = true) @RequestParam LocalDateTime startDate,
            @Parameter(description = "结束时间", required = true) @RequestParam LocalDateTime endDate) {
        Map<String, BigDecimal> stats = statisticsService.getAuctionStatistics(startDate, endDate);
        return ApiResponse.success(stats);
    }
}
