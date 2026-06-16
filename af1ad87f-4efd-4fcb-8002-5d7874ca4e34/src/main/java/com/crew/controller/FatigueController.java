package com.crew.controller;

import com.crew.common.ApiResponse;
import com.crew.common.PageResult;
import com.crew.dto.DutyCheckRequest;
import com.crew.dto.FatigueReportVO;
import com.crew.entity.DutyRecord;
import com.crew.entity.FatigueAlert;
import com.crew.service.FatigueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@Tag(name = "疲劳监控", description = "执勤追踪、预警触发、历史分析")
@RestController
@RequestMapping("/api/v1/fatigue")
@RequiredArgsConstructor
public class FatigueController {

    private final FatigueService fatigueService;

    @Operation(summary = "执勤签到")
    @PostMapping("/check-in")
    public ApiResponse<DutyRecord> checkIn(@Valid @RequestBody DutyCheckRequest request) {
        return ApiResponse.success(fatigueService.checkIn(request));
    }

    @Operation(summary = "执勤签退")
    @PostMapping("/check-out")
    public ApiResponse<DutyRecord> checkOut(@Valid @RequestBody DutyCheckRequest request) {
        return ApiResponse.success(fatigueService.checkOut(request));
    }

    @Operation(summary = "查询疲劳风险报告")
    @GetMapping("/report/{crewId}")
    public ApiResponse<FatigueReportVO> getFatigueReport(
            @Parameter(description = "机组人员ID") @PathVariable Long crewId) {
        return ApiResponse.success(fatigueService.getFatigueReport(crewId));
    }

    @Operation(summary = "分页查询疲劳预警记录")
    @GetMapping("/alerts")
    public ApiResponse<PageResult<FatigueAlert>> listAlerts(
            @Parameter(description = "机组人员ID") @RequestParam(required = false) Long crewId,
            @Parameter(description = "预警级别: YELLOW/RED/FATIGUE_HIGH") @RequestParam(required = false) String alertLevel,
            @Parameter(description = "状态: ACTIVE/RESOLVED") @RequestParam(required = false) String status,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(fatigueService.listAlerts(crewId, alertLevel, status, page, size));
    }

    @Operation(summary = "分页查询执勤记录")
    @GetMapping("/duty-records")
    public ApiResponse<PageResult<DutyRecord>> listDutyRecords(
            @Parameter(description = "机组人员ID") @RequestParam(required = false) Long crewId,
            @Parameter(description = "开始日期") @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(fatigueService.listDutyRecords(crewId, startDate, endDate, page, size));
    }

    @Operation(summary = "解除疲劳预警")
    @PostMapping("/alerts/{alertId}/resolve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<Void> resolveAlert(
            @Parameter(description = "预警ID") @PathVariable Long alertId) {
        fatigueService.resolveAlert(alertId);
        return ApiResponse.success();
    }
}
