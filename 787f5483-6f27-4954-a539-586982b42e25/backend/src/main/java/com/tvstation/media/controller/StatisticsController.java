package com.tvstation.media.controller;

import com.tvstation.media.common.ApiResponse;
import com.tvstation.media.dto.WorkloadStatDTO;
import com.tvstation.media.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/statistics")
@RequiredArgsConstructor
@Tag(name = "统计管理", description = "数据统计相关接口")
public class StatisticsController {

    private final StatisticsService statisticsService;

    @GetMapping("/workload")
    @Operation(summary = "获取工作量统计")
    public ApiResponse<List<WorkloadStatDTO>> getWorkload(
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate,
            @RequestParam String groupBy,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) Long userId) {
        List<WorkloadStatDTO> result = statisticsService.getWorkloadStatistics(
                startDate, endDate, groupBy, department, userId);
        return ApiResponse.success("工作量统计查询成功", result);
    }

    @GetMapping("/production")
    @Operation(summary = "获取生产统计")
    public ApiResponse<Map<String, Object>> getProduction(
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        return ApiResponse.success("生产统计查询成功",
                statisticsService.getProductionStatistics(startDate, endDate));
    }

    @GetMapping("/efficiency")
    @Operation(summary = "获取效率统计")
    public ApiResponse<Map<String, Object>> getEfficiency(
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        return ApiResponse.success("效率统计查询成功",
                statisticsService.getEfficiencyStatistics(startDate, endDate));
    }
}
