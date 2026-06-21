package com.gov.specialequipment.controller;

import com.gov.specialequipment.annotation.AuditLog;
import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.common.Result;
import com.gov.specialequipment.dto.InspectionPlanQueryDTO;
import com.gov.specialequipment.dto.InspectionQueryDTO;
import com.gov.specialequipment.dto.InspectionReportDTO;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.InspectionPlan;
import com.gov.specialequipment.entity.InspectionRecord;
import com.gov.specialequipment.service.InspectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "检验管理")
@RestController
@RequestMapping("/inspections")
@RequiredArgsConstructor
public class InspectionController {

    private final InspectionService inspectionService;

    @Operation(summary = "接收检验报告")
    @PostMapping("/reports")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'INSPECTION_AGENCY')")
    @AuditLog(module = "检验管理", operationType = "新增", description = "接收检验报告")
    public Result<InspectionRecord> receiveReport(@Valid @RequestBody InspectionReportDTO dto) {
        return Result.success("检验报告接收成功", inspectionService.receiveReport(dto));
    }

    @Operation(summary = "查询检验报告详情")
    @GetMapping("/reports/{id}")
    public Result<InspectionRecord> getInspection(@PathVariable Long id) {
        return Result.success(inspectionService.getInspectionById(id));
    }

    @Operation(summary = "分页查询检验报告")
    @PostMapping("/reports/page")
    public Result<PageResult<InspectionRecord>> queryInspections(@RequestBody InspectionQueryDTO dto) {
        return Result.success(inspectionService.queryInspections(dto));
    }

    @Operation(summary = "查询设备检验历史")
    @GetMapping("/device/{deviceId}/history")
    public Result<List<InspectionRecord>> getInspectionHistory(@PathVariable Long deviceId) {
        return Result.success(inspectionService.getInspectionHistory(deviceId));
    }

    @Operation(summary = "创建检验计划")
    @PostMapping("/plans")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @AuditLog(module = "检验管理", operationType = "新增", description = "创建检验计划")
    public Result<InspectionPlan> createPlan(
            @RequestParam Long deviceId,
            @RequestParam(required = false) Long agencyId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate planDate) {
        return Result.success("检验计划创建成功", inspectionService.createInspectionPlan(deviceId, agencyId, planDate));
    }

    @Operation(summary = "分页查询检验计划")
    @PostMapping("/plans/page")
    public Result<PageResult<InspectionPlan>> queryPlans(@RequestBody InspectionPlanQueryDTO dto) {
        return Result.success(inspectionService.queryInspectionPlans(dto));
    }

    @Operation(summary = "获取超期预警设备列表（30天内到期）")
    @GetMapping("/warnings")
    public Result<List<Device>> getWarningDevices() {
        return Result.success(inspectionService.getOverdueWarningDevices());
    }

    @Operation(summary = "获取已超期未检设备列表")
    @GetMapping("/overdue")
    public Result<List<Device>> getOverdueDevices() {
        return Result.success(inspectionService.getOverdueDevices());
    }
}
