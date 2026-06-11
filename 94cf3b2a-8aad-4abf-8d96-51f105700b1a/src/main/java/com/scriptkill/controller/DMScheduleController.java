package com.scriptkill.controller;

import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.schedule.DMScheduleResponse;
import com.scriptkill.dto.schedule.MonthlySalary;
import com.scriptkill.service.AuthService;
import com.scriptkill.service.DMScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/dm-schedules")
@Tag(name = "dm", description = "DM排班、提成计算")
public class DMScheduleController {

    private final DMScheduleService dmScheduleService;
    private final AuthService authService;

    public DMScheduleController(DMScheduleService dmScheduleService,
                                AuthService authService) {
        this.dmScheduleService = dmScheduleService;
        this.authService = authService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "创建排班", description = "店长或管理员为DM创建排班")
    public ApiResponse<DMScheduleResponse> createSchedule(
            @Parameter(description = "DM用户ID") @RequestParam Long dmId,
            @Parameter(description = "排班日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Parameter(description = "开始时间") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @Parameter(description = "结束时间") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime endTime,
            @Parameter(description = "班次类型") @RequestParam(required = false) String shiftType,
            @Parameter(description = "关联会话ID") @RequestParam(required = false) Long sessionId,
            @Parameter(description = "基础工资") @RequestParam(required = false) Integer baseSalary) {
        DMScheduleResponse response = dmScheduleService.createSchedule(
                dmId, date, startTime, endTime, shiftType, sessionId, baseSalary);
        return ApiResponse.success("排班创建成功", response);
    }

    @GetMapping("/dm/{dmId}")
    @Operation(summary = "获取DM排班列表", description = "查看指定DM的排班")
    public ApiResponse<List<DMScheduleResponse>> getDmSchedules(
            @Parameter(description = "DM用户ID") @PathVariable Long dmId,
            @Parameter(description = "开始日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<DMScheduleResponse> schedules = dmScheduleService.getDmSchedules(dmId, startDate, endDate);
        return ApiResponse.success(schedules);
    }

    @GetMapping("/date/{date}")
    @Operation(summary = "获取某日排班", description = "查看指定日期的所有DM排班")
    public ApiResponse<List<DMScheduleResponse>> getSchedulesByDate(
            @Parameter(description = "日期") @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<DMScheduleResponse> schedules = dmScheduleService.getSchedulesByDate(date);
        return ApiResponse.success(schedules);
    }

    @PostMapping("/{scheduleId}/calculate")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "计算提成", description = "计算单场DM提成")
    public ApiResponse<DMScheduleResponse> calculateCommission(
            @Parameter(description = "排班ID") @PathVariable Long scheduleId) {
        DMScheduleResponse response = dmScheduleService.calculateCommission(scheduleId);
        return ApiResponse.success("提成计算完成", response);
    }

    @PostMapping("/{scheduleId}/complete")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "完成排班", description = "标记排班完成并计算提成")
    public ApiResponse<DMScheduleResponse> markCompleted(
            @Parameter(description = "排班ID") @PathVariable Long scheduleId) {
        DMScheduleResponse response = dmScheduleService.markSessionCompleted(scheduleId);
        return ApiResponse.success("排班已完成", response);
    }

    @PostMapping("/{scheduleId}/mark-paid")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "标记已结算", description = "标记工资已发放")
    public ApiResponse<Void> markAsPaid(
            @Parameter(description = "排班ID") @PathVariable Long scheduleId) {
        dmScheduleService.markAsPaid(scheduleId);
        return ApiResponse.success("已标记为已结算", null);
    }

    @GetMapping("/salary/{dmId}/monthly")
    @Operation(summary = "生成月度工资单", description = "生成指定DM的月度工资明细")
    public ApiResponse<MonthlySalary> generateMonthlySalary(
            @Parameter(description = "DM用户ID") @PathVariable Long dmId,
            @Parameter(description = "年份") @RequestParam int year,
            @Parameter(description = "月份") @RequestParam int month) {
        MonthlySalary salary = dmScheduleService.generateMonthlySalary(dmId, year, month);
        return ApiResponse.success(salary);
    }
}
