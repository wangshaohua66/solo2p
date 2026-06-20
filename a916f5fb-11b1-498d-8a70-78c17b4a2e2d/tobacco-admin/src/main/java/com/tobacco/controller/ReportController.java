package com.tobacco.controller;

import com.tobacco.common.result.Result;
import com.tobacco.dto.response.*;
import com.tobacco.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "统计报表", description = "许可证、订货、稽查、配送、信用等各模块统计报表接口")
@RestController
@RequestMapping("/report")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @Operation(summary = "获取总览统计数据", description = "获取系统各模块的核心统计指标总览")
    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<Map<String, Object>> getOverview(
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId) {
        return Result.success(reportService.getOverviewStatistics(countyId));
    }

    @Operation(summary = "许可证统计报表", description = "按时间维度统计许可证存量、新增、到期等数据")
    @GetMapping("/license")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<LicenseStatistics> getLicenseStatistics(
            @Parameter(description = "时间维度：month月/quarter季/year年")
            @RequestParam(defaultValue = "month") String timeDimension,
            @Parameter(description = "开始时间") @RequestParam(required = false) String startTime,
            @Parameter(description = "结束时间") @RequestParam(required = false) String endTime,
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId) {
        return Result.success(reportService.getLicenseStatistics(
                timeDimension, startTime, endTime, countyId));
    }

    @Operation(summary = "订货统计报表", description = "按时间维度统计订货量、金额、履约率等数据")
    @GetMapping("/order")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<OrderStatistics> getOrderStatistics(
            @Parameter(description = "时间维度：month月/quarter季/year年")
            @RequestParam(defaultValue = "month") String timeDimension,
            @Parameter(description = "开始时间") @RequestParam(required = false) String startTime,
            @Parameter(description = "结束时间") @RequestParam(required = false) String endTime,
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId) {
        return Result.success(reportService.getOrderStatistics(
                timeDimension, startTime, endTime, countyId));
    }

    @Operation(summary = "稽查违规统计报表", description = "统计稽查任务量、违规率、违规类型分布等")
    @GetMapping("/inspection")
    @PreAuthorize("hasAnyRole('ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<InspectionStatistics> getInspectionStatistics(
            @Parameter(description = "时间维度：month月/quarter季/year年")
            @RequestParam(defaultValue = "month") String timeDimension,
            @Parameter(description = "开始时间") @RequestParam(required = false) String startTime,
            @Parameter(description = "结束时间") @RequestParam(required = false) String endTime,
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId) {
        return Result.success(reportService.getInspectionStatistics(
                timeDimension, startTime, endTime, countyId));
    }

    @Operation(summary = "配送统计报表", description = "统计配送效率、装载率、路线等数据")
    @GetMapping("/delivery")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_AUDITOR')")
    public Result<DeliveryStatistics> getDeliveryStatistics(
            @Parameter(description = "时间维度：month月/quarter季/year年")
            @RequestParam(defaultValue = "month") String timeDimension,
            @Parameter(description = "开始时间") @RequestParam(required = false) String startTime,
            @Parameter(description = "结束时间") @RequestParam(required = false) String endTime,
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId) {
        return Result.success(reportService.getDeliveryStatistics(
                timeDimension, startTime, endTime, countyId));
    }

    @Operation(summary = "信用统计报表", description = "统计信用等级分布、变更次数、升降级情况等")
    @GetMapping("/credit")
    @PreAuthorize("hasAnyRole('ROLE_AUDITOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<CreditStatistics> getCreditStatistics(
            @Parameter(description = "时间维度：month月/quarter季/year年")
            @RequestParam(defaultValue = "month") String timeDimension,
            @Parameter(description = "开始时间") @RequestParam(required = false) String startTime,
            @Parameter(description = "结束时间") @RequestParam(required = false) String endTime,
            @Parameter(description = "县局ID") @RequestParam(required = false) Long countyId) {
        return Result.success(reportService.getCreditStatistics(
                timeDimension, startTime, endTime, countyId));
    }
}
