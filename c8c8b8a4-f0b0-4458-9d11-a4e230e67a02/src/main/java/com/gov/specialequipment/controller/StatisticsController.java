package com.gov.specialequipment.controller;

import com.gov.specialequipment.common.Result;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.HazardRecord;
import com.gov.specialequipment.service.StatisticsService;
import com.gov.specialequipment.vo.StatisticsVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Tag(name = "统计分析")
@RestController
@RequestMapping("/statistics")
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;

    @Operation(summary = "获取总览统计数据")
    @GetMapping("/overview")
    public Result<StatisticsVO> getOverview() {
        return Result.success(statisticsService.getOverviewStatistics());
    }

    @Operation(summary = "设备类型分布统计")
    @GetMapping("/devices/type")
    public Result<List<Map<String, Object>>> getDeviceTypeStatistics() {
        return Result.success(statisticsService.getDeviceTypeStatistics());
    }

    @Operation(summary = "设备状态分布统计")
    @GetMapping("/devices/status")
    public Result<List<Map<String, Object>>> getDeviceStatusStatistics() {
        return Result.success(statisticsService.getDeviceStatusStatistics());
    }

    @Operation(summary = "设备区域分布统计")
    @GetMapping("/devices/region")
    public Result<List<Map<String, Object>>> getDeviceRegionStatistics() {
        return Result.success(statisticsService.getDeviceRegionStatistics());
    }

    @Operation(summary = "检验结论分布统计")
    @GetMapping("/inspections/conclusion")
    public Result<List<Map<String, Object>>> getInspectionConclusionStatistics(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate end) {
        return Result.success(statisticsService.getInspectionConclusionStatistics(start, end));
    }

    @Operation(summary = "检验月度趋势统计")
    @GetMapping("/inspections/trend")
    public Result<List<Map<String, Object>>> getInspectionTrendStatistics(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate end) {
        return Result.success(statisticsService.getInspectionTrendStatistics(start, end));
    }

    @Operation(summary = "隐患等级分布统计")
    @GetMapping("/hazards/level")
    public Result<List<Map<String, Object>>> getHazardLevelStatistics() {
        return Result.success(statisticsService.getHazardLevelStatistics());
    }

    @Operation(summary = "隐患状态分布统计")
    @GetMapping("/hazards/status")
    public Result<List<Map<String, Object>>> getHazardStatusStatistics() {
        return Result.success(statisticsService.getHazardStatusStatistics());
    }

    @Operation(summary = "隐患月度趋势统计")
    @GetMapping("/hazards/trend")
    public Result<List<Map<String, Object>>> getHazardTrendStatistics(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate end) {
        return Result.success(statisticsService.getHazardTrendStatistics(start, end));
    }

    @Operation(summary = "导出超期设备清单")
    @GetMapping("/devices/overdue")
    public Result<List<Device>> getOverdueDeviceList() {
        return Result.success(statisticsService.getOverdueDeviceList());
    }

    @Operation(summary = "导出逾期隐患清单")
    @GetMapping("/hazards/overdue")
    public Result<List<HazardRecord>> getOverdueHazardList() {
        return Result.success(statisticsService.getOverdueHazardList());
    }

    @Operation(summary = "检验覆盖率统计（按设备类型）")
    @GetMapping("/inspections/coverage/device-type")
    public Result<List<InspectionCoverageVO>> getInspectionCoverageByDeviceType() {
        return Result.success(statisticsService.getInspectionCoverageByDeviceType());
    }

    @Operation(summary = "检验覆盖率统计（按区域）")
    @GetMapping("/inspections/coverage/region")
    public Result<List<InspectionCoverageVO>> getInspectionCoverageByRegion() {
        return Result.success(statisticsService.getInspectionCoverageByRegion());
    }
}
