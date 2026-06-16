package com.emergency.incident.controller;

import com.emergency.common.dto.PageResult;
import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentStatus;
import com.emergency.common.enums.IncidentType;
import com.emergency.common.result.Result;
import com.emergency.common.util.SecurityUtils;
import com.emergency.incident.dto.IncidentQueryRequest;
import com.emergency.incident.dto.IncidentReportRequest;
import com.emergency.incident.entity.Incident;
import com.emergency.incident.entity.IncidentOperationLog;
import com.emergency.incident.entity.ResponsePlan;
import com.emergency.incident.service.IncidentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/incidents")
@RequiredArgsConstructor
@Tag(name = "灾情事件管理", description = "灾情上报、查询、状态管理接口")
public class IncidentController {

    private final IncidentService incidentService;

    @PostMapping("/report")
    @Operation(summary = "灾情上报", description = "人工上报灾情信息，系统自动定级")
    public Result<Incident> reportIncident(@Valid @RequestBody IncidentReportRequest request) {
        return Result.success(incidentService.reportIncident(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取灾情详情")
    public Result<Incident> getIncidentById(@PathVariable Long id) {
        return Result.success(incidentService.getIncidentById(id));
    }

    @GetMapping("/no/{incidentNo}")
    @Operation(summary = "根据编号获取灾情")
    public Result<Incident> getIncidentByNo(@PathVariable String incidentNo) {
        return Result.success(incidentService.getIncidentByNo(incidentNo));
    }

    @PostMapping("/query")
    @Operation(summary = "分页查询灾情列表")
    public Result<PageResult<Incident>> queryIncidents(@Valid @RequestBody IncidentQueryRequest request) {
        return Result.success(incidentService.queryIncidents(request));
    }

    @GetMapping("/active")
    @Operation(summary = "获取活跃灾情列表", description = "获取状态为响应中、处置中的灾情")
    public Result<List<Incident>> getActiveIncidents() {
        return Result.success(incidentService.getActiveIncidents());
    }

    @GetMapping("/nearby")
    @Operation(summary = "获取周边灾情", description = "根据坐标和半径查询周边灾情")
    public Result<List<Incident>> getNearbyIncidents(
            @Parameter(description = "经度") @RequestParam Double lng,
            @Parameter(description = "纬度") @RequestParam Double lat,
            @Parameter(description = "查询半径(公里)") @RequestParam(defaultValue = "50") Double radius) {
        return Result.success(incidentService.getNearbyIncidents(lng, lat, radius));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "更新灾情状态")
    public Result<Incident> updateStatus(
            @PathVariable Long id,
            @Parameter(description = "新状态") @RequestParam IncidentStatus status) {
        return Result.success(incidentService.updateIncidentStatus(id, status));
    }

    @PutMapping("/{id}/upgrade")
    @Operation(summary = "灾情等级升级")
    public Result<Incident> upgradeLevel(
            @PathVariable Long id,
            @Parameter(description = "新等级") @RequestParam IncidentLevel level) {
        return Result.success(incidentService.upgradeIncidentLevel(id, level));
    }

    @GetMapping("/{id}/logs")
    @Operation(summary = "获取灾情操作日志")
    public Result<List<IncidentOperationLog>> getOperationLogs(@PathVariable Long id) {
        return Result.success(incidentService.getOperationLogs(id));
    }

    @GetMapping("/plan/match")
    @Operation(summary = "获取匹配的应急预案")
    public Result<ResponsePlan> getMatchingPlan(
            @Parameter(description = "灾情类型") @RequestParam IncidentType type,
            @Parameter(description = "灾情等级") @RequestParam IncidentLevel level) {
        return Result.success(incidentService.getMatchingPlan(type, level));
    }

    @GetMapping("/statistics")
    @Operation(summary = "获取灾情统计数据")
    public Result<Map<String, Long>> getStatistics(
            @Parameter(description = "行政区划代码") @RequestParam(required = false) String regionCode) {
        List<Long> orgIds = SecurityUtils.getCurrentUser() != null
                ? SecurityUtils.getCurrentUser().getAccessibleOrgIds()
                : null;
        return Result.success(incidentService.getStatistics(regionCode, orgIds));
    }

    @PostMapping("/calculate-level")
    @Operation(summary = "计算灾情等级", description = "根据灾情指标计算建议等级")
    public Result<IncidentLevel> calculateLevel(@Valid @RequestBody IncidentReportRequest request) {
        return Result.success(incidentService.calculateIncidentLevel(request));
    }
}
