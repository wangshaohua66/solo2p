package com.crew.controller;

import com.crew.common.ApiResponse;
import com.crew.dto.DrillDownVO;
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
@RequestMapping("/api/v1/statistics")
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

    @Operation(summary = "按机型维度下钻统计")
    @GetMapping("/drilldown/aircraft")
    public ApiResponse<DrillDownVO> drillDownByAircraft(
            @Parameter(description = "起始月份", example = "2026-01") @RequestParam String startPeriod,
            @Parameter(description = "结束月份", example = "2026-06") @RequestParam String endPeriod,
            @Parameter(description = "机型", example = "B737") @RequestParam String aircraftType) {
        return ApiResponse.success(statisticsService.drillDownByAircraft(startPeriod, endPeriod, aircraftType));
    }

    @Operation(summary = "获取所有机型统计（用于列表展示）")
    @GetMapping("/drilldown/aircraft/all")
    public ApiResponse<List<DrillDownVO>> listAllAircraft(
            @Parameter(description = "起始月份", example = "2026-01") @RequestParam String startPeriod,
            @Parameter(description = "结束月份", example = "2026-06") @RequestParam String endPeriod) {
        return ApiResponse.success(statisticsService.listAllAircraft(startPeriod, endPeriod));
    }

    @Operation(summary = "按航线维度下钻统计")
    @GetMapping("/drilldown/route")
    public ApiResponse<DrillDownVO> drillDownByRoute(
            @Parameter(description = "起始月份", example = "2026-01") @RequestParam String startPeriod,
            @Parameter(description = "结束月份", example = "2026-06") @RequestParam String endPeriod,
            @Parameter(description = "起飞机场", example = "PEK") @RequestParam String departure,
            @Parameter(description = "到达机场", example = "SHA") @RequestParam String arrival) {
        return ApiResponse.success(statisticsService.drillDownByRoute(startPeriod, endPeriod, departure, arrival));
    }

    @Operation(summary = "按人员维度下钻统计")
    @GetMapping("/drilldown/crew/{crewId}")
    public ApiResponse<DrillDownVO> drillDownByCrew(
            @Parameter(description = "起始月份", example = "2026-01") @RequestParam String startPeriod,
            @Parameter(description = "结束月份", example = "2026-06") @RequestParam String endPeriod,
            @Parameter(description = "机组人员ID") @PathVariable Long crewId) {
        return ApiResponse.success(statisticsService.drillDownByCrew(startPeriod, endPeriod, crewId));
    }

    @Operation(summary = "按基地维度下钻统计")
    @GetMapping("/drilldown/base")
    public ApiResponse<DrillDownVO> drillDownByBase(
            @Parameter(description = "起始月份", example = "2026-01") @RequestParam String startPeriod,
            @Parameter(description = "结束月份", example = "2026-06") @RequestParam String endPeriod,
            @Parameter(description = "基地代码", example = "PEK") @RequestParam String base) {
        return ApiResponse.success(statisticsService.drillDownByBase(startPeriod, endPeriod, base));
    }

    @Operation(summary = "获取所有基地统计（用于列表展示）")
    @GetMapping("/drilldown/base/all")
    public ApiResponse<List<DrillDownVO>> listAllBases(
            @Parameter(description = "起始月份", example = "2026-01") @RequestParam String startPeriod,
            @Parameter(description = "结束月份", example = "2026-06") @RequestParam String endPeriod) {
        return ApiResponse.success(statisticsService.listAllBases(startPeriod, endPeriod));
    }
}
