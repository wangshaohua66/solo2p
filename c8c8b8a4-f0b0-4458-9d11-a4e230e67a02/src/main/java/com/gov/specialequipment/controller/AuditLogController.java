package com.gov.specialequipment.controller;

import com.gov.specialequipment.common.PageQuery;
import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.common.Result;
import com.gov.specialequipment.entity.AuditLog;
import com.gov.specialequipment.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@Tag(name = "日志审计")
@RestController
@RequestMapping("/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    @Operation(summary = "分页查询审计日志")
    @PostMapping("/page")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<PageResult<AuditLog>> queryLogs(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String operationType,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestBody PageQuery pageQuery) {
        return Result.success(auditLogService.queryLogs(module, operationType, operatorId, startTime, endTime, pageQuery));
    }
}
