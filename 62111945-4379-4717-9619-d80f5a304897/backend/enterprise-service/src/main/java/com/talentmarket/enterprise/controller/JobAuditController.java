package com.talentmarket.enterprise.controller;

import com.talentmarket.common.result.Result;
import com.talentmarket.enterprise.entity.JobPosition;
import com.talentmarket.enterprise.service.JobPositionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/enterprise/jobs")
@RequiredArgsConstructor
public class JobAuditController {

    private final JobPositionService jobPositionService;

    @PostMapping("/audit")
    public Result<JobPositionService.SensitiveAuditResult> auditSensitiveWords(
            @RequestBody JobPosition position) {
        log.info("岗位敏感词预审核，岗位名称: {}", position.getPositionName());
        JobPositionService.SensitiveAuditResult result = jobPositionService.auditSensitiveWords(position);
        return Result.success(result);
    }

    @GetMapping("/{id}/audit")
    public Result<JobPositionService.SensitiveAuditResult> getLatestAudit(@PathVariable Long id) {
        return Result.success(jobPositionService.getLatestAudit(id));
    }

    @PostMapping("/{id}/republish")
    public Result<Map<String, Object>> republishAfterFix(
            @PathVariable Long id,
            @RequestBody Map<String, String> updates) {
        log.info("修改后重新发布岗位，岗位ID: {}, 更新字段: {}", id, updates.keySet());
        try {
            JobPosition position = jobPositionService.republishAfterFix(id, updates);
            Map<String, Object> data = new HashMap<>();
            data.put("job", position);
            data.put("auditPassed", true);
            return Result.success(data);
        } catch (JobPositionService.SensitiveWordAuditException e) {
            log.warn("重新发布敏感词审核未通过，岗位ID: {}", id);
            Map<String, Object> data = new HashMap<>();
            data.put("auditPassed", false);
            data.put("sensitiveWords", e.getAuditResult().getSensitiveWords());
            data.put("fieldViolations", e.getAuditResult().getFieldViolations());
            data.put("message", e.getAuditResult().getMessage());

            Result<Map<String, Object>> result = new Result<>();
            result.setCode(e.getCode());
            result.setMessage(e.getMessage());
            result.setData(data);
            return result;
        }
    }

    @PostMapping
    public Result<Map<String, Object>> publish(@RequestBody JobPosition position) {
        log.info("发布岗位，企业ID: {}, 岗位名称: {}", position.getEnterpriseId(), position.getPositionName());
        try {
            JobPosition saved = jobPositionService.publish(position);
            Map<String, Object> data = new HashMap<>();
            data.put("job", saved);
            data.put("auditPassed", true);
            return Result.success(data);
        } catch (JobPositionService.SensitiveWordAuditException e) {
            log.warn("岗位发布敏感词审核未通过，企业ID: {}, 岗位: {}",
                    position.getEnterpriseId(), position.getPositionName());

            Map<String, Object> data = new HashMap<>();
            data.put("auditPassed", false);
            data.put("sensitiveWords", e.getAuditResult().getSensitiveWords());
            data.put("fieldViolations", e.getAuditResult().getFieldViolations());
            data.put("message", e.getAuditResult().getMessage());

            Result<Map<String, Object>> result = new Result<>();
            result.setCode(e.getCode());
            result.setMessage(e.getMessage());
            result.setData(data);
            return result;
        }
    }
}
