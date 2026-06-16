package com.crew.controller;

import com.crew.common.ApiResponse;
import com.crew.dto.StatisticsRequest;
import com.crew.dto.StatisticsVO;
import com.crew.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "统计分析报表", description = "按月/季/年统计机组利用率、违规次数、疲劳指数分布、人力缺口")
@RestController
@RequestMapping("/statistics")
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;

    @Operation(summary = "查询统计报表")
    @GetMapping
    public ApiResponse<StatisticsVO> getStatistics(StatisticsRequest request) {
        return ApiResponse.success(statisticsService.getStatistics(request));
    }

    @Operation(summary = "按月查询统计趋势")
    @GetMapping("/monthly")
    public ApiResponse<List<StatisticsVO>> getMonthlyStatistics(
            @Parameter(description = "起始月份", example = "2026-01") @RequestParam String startPeriod,
            @Parameter(description = "结束月份", example = "2026-06") @RequestParam String endPeriod) {
        return ApiResponse.success(statisticsService.getMonthlyStatistics(startPeriod, endPeriod));
    }
}
