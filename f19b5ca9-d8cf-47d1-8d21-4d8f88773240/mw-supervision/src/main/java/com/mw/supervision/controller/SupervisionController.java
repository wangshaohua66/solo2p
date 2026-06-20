package com.mw.supervision.controller;

import com.mw.common.response.ApiResponse;
import com.mw.common.response.PageResult;
import com.mw.supervision.document.Alert;
import com.mw.supervision.document.AlertRule;
import com.mw.supervision.dto.AlertConfirmRequest;
import com.mw.supervision.service.SupervisionAlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "监管预警", description = "规则配置、异常扫描、省固废平台推送、确认反馈")
@RestController
@RequestMapping("/supervision")
@RequiredArgsConstructor
public class SupervisionController {

    private final SupervisionAlertService supervisionAlertService;

    @Operation(summary = "配置/更新预警规则")
    @PostMapping("/rules")
    public ApiResponse<AlertRule> saveRule(@RequestBody AlertRule rule) {
        return ApiResponse.success(supervisionAlertService.saveRule(rule));
    }

    @Operation(summary = "查询全部预警规则")
    @GetMapping("/rules")
    public ApiResponse<List<AlertRule>> listRules() {
        return ApiResponse.success(supervisionAlertService.listRules());
    }

    @Operation(summary = "手动触发异常扫描")
    @PostMapping("/scan")
    public ApiResponse<Integer> scan() {
        return ApiResponse.success(supervisionAlertService.manualScan());
    }

    @Operation(summary = "推送指定预警至省固废平台")
    @PostMapping("/alerts/{alertId}/push")
    public ApiResponse<Void> push(@PathVariable String alertId) {
        supervisionAlertService.listAlerts(null, null, null, 1, Integer.MAX_VALUE).stream()
                .filter(a -> alertId.equals(a.getId()))
                .findFirst()
                .ifPresent(supervisionAlertService::pushAlert);
        return ApiResponse.success();
    }

    @Operation(summary = "预警确认与处理反馈（闭环）")
    @PostMapping("/alerts/confirm")
    public ApiResponse<Alert> confirm(@Valid @RequestBody AlertConfirmRequest request) {
        return ApiResponse.success(supervisionAlertService.confirmAlert(request));
    }

    @Operation(summary = "分页查询预警列表")
    @GetMapping("/alerts")
    public ApiResponse<PageResult<Alert>> alerts(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<Alert> alerts = supervisionAlertService.listAlerts(type, status, level, page, size);
        return ApiResponse.success(PageResult.of(alerts, alerts.size(), page, size));
    }
}
