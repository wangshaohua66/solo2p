package com.gov.specialequipment.controller;

import com.gov.specialequipment.annotation.AuditLog;
import com.gov.specialequipment.common.Result;
import com.gov.specialequipment.dto.AccidentReportDTO;
import com.gov.specialequipment.entity.AccidentReport;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.entity.EmergencyResource;
import com.gov.specialequipment.service.EmergencyService;
import com.gov.specialequipment.vo.EmergencyArchiveVO;
import com.gov.specialequipment.vo.EmergencyResourceVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "应急调度")
@RestController
@RequestMapping("/emergency")
@RequiredArgsConstructor
public class EmergencyController {

    private final EmergencyService emergencyService;

    @Operation(summary = "事故上报")
    @PostMapping("/accidents")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'USE_UNIT')")
    @AuditLog(module = "应急调度", operationType = "新增", description = "事故上报")
    public Result<AccidentReport> reportAccident(@Valid @RequestBody AccidentReportDTO dto) {
        return Result.success("事故上报成功", emergencyService.reportAccident(dto));
    }

    @Operation(summary = "查询事故详情")
    @GetMapping("/accidents/{id}")
    public Result<AccidentReport> getAccident(@PathVariable Long id) {
        return Result.success(emergencyService.getAccidentById(id));
    }

    @Operation(summary = "获取应急档案调取（设备档案+检验记录+隐患+历史事故+应急资源）")
    @GetMapping("/archive/{accidentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<EmergencyArchiveVO> getEmergencyArchive(@PathVariable Long accidentId) {
        return Result.success(emergencyService.getEmergencyArchive(accidentId));
    }

    @Operation(summary = "快速调取设备档案")
    @GetMapping("/device/{deviceId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<Device> getDeviceArchive(@PathVariable Long deviceId) {
        return Result.success(emergencyService.getDeviceArchive(deviceId));
    }

    @Operation(summary = "应急资源调度")
    @GetMapping("/resources")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<List<EmergencyResourceVO>> dispatchResources(
            @RequestParam(required = false) String regionCode,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Double latitude) {
        return Result.success(emergencyService.dispatchResources(regionCode, resourceType, longitude, latitude));
    }

    @Operation(summary = "获取事故列表")
    @GetMapping("/accidents")
    public Result<List<AccidentReport>> getAccidentList() {
        return Result.success(emergencyService.getAccidentList());
    }

    @Operation(summary = "更新事故处理状态")
    @PutMapping("/accidents/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @AuditLog(module = "应急调度", operationType = "修改", description = "更新事故处理状态")
    public Result<AccidentReport> updateAccidentStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String measures) {
        return Result.success("状态更新成功", emergencyService.updateAccidentStatus(id, status, measures));
    }
}
