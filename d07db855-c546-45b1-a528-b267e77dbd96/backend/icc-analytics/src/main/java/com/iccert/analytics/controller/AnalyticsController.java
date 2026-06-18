package com.iccert.analytics.controller;

import com.iccert.analytics.entity.InspectionRawRecord;
import com.iccert.analytics.service.AnalyticsService;
import com.iccert.common.result.R;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Tag(name = "统计分析与审计", description = "原始记录防篡改追加存储、哈希链校验、统计报表、审计日志")
@RestController
@RequestMapping
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @Operation(summary = "追加写入原始检测记录(防篡改不可修改)")
    @PostMapping("/raw-record/append")
    public R<InspectionRawRecord> appendRawRecord(@RequestBody Map<String, Object> params,
                                                  HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(analyticsService.appendRawRecord(
                Long.valueOf(params.get("taskId").toString()),
                Long.valueOf(params.get("sampleId").toString()),
                (String) params.get("sampleCode"),
                Long.valueOf(params.get("testItemId").toString()),
                (String) params.get("testItemCode"),
                (String) params.get("testItemName"),
                (String) params.get("testMethod"),
                (String) params.get("standardCode"),
                params.get("testValue") != null ? new BigDecimal(params.get("testValue").toString()) : null,
                (String) params.get("testUnit"),
                params.get("standardMin") != null ? new BigDecimal(params.get("standardMin").toString()) : null,
                params.get("standardMax") != null ? new BigDecimal(params.get("standardMax").toString()) : null,
                params.get("equipmentId") != null ? Long.valueOf(params.get("equipmentId").toString()) : null,
                (String) params.get("equipmentCode"),
                userId, username,
                (String) params.get("environmentParams"),
                (String) params.get("testDataJson")));
    }

    @Operation(summary = "校验某任务全部原始记录的完整性(哈希链)")
    @GetMapping("/raw-record/verify/{taskId}")
    public R<Map<String, Object>> verifyIntegrity(@PathVariable Long taskId) {
        return R.ok(analyticsService.verifyTaskIntegrity(taskId));
    }

    @Operation(summary = "获取仪表盘统计指标")
    @GetMapping("/dashboard/stats")
    public R<Map<String, Object>> dashboardStats() {
        return R.ok(analyticsService.getDashboardStats());
    }

    @Operation(summary = "获取审计日志")
    @GetMapping("/audit/logs")
    public R<List<Map<String, Object>>> auditLogs() {
        return R.ok(analyticsService.getAuditLogs());
    }
}
