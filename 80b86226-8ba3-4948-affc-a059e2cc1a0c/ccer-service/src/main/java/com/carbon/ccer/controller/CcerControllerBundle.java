package com.carbon.ccer.controller;

import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.ccer.entity.CcerIssuance;
import com.carbon.ccer.entity.CcerProject;
import com.carbon.ccer.entity.CcerValidation;
import com.carbon.ccer.entity.CcerVerification;
import com.carbon.ccer.service.CcerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/ccer-projects")
@RequiredArgsConstructor
@Tag(name = "CCER项目", description = "CCER 项目立项、审定、核证、签发全生命周期")
public class CcerProjectController {
    private final CcerService service;

    @PostMapping
    @Operation(summary = "创建CCER项目立项(DRAFT)", description = "支持造林(A/R)、并网光热(CSP)、海上风电、甲烷利用等15类方法学")
    public R<CcerProject> create(@RequestBody CcerProject p) {
        return R.ok(service.createProject(p));
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询项目详情")
    public R<CcerProject> get(@PathVariable String id) {
        return R.ok(service.getProject(id));
    }

    @GetMapping
    @Operation(summary = "分页查询CCER项目")
    public R<PageResult<CcerProject>> list(
            @Parameter(description = "状态筛选") @RequestParam(required = false) CcerProject.Status status,
            @Parameter(description = "项目类型")
            @RequestParam(required = false) CcerProject.Type type,
            @ParameterObject PageQuery pq) {
        return R.ok(service.listProjects(status, type, pq));
    }

    @PostMapping("/{id}/submit")
    @Operation(summary = "提交主管部门备案申请(SUBMITTED)")
    public R<CcerProject> submit(@PathVariable String id) {
        return R.ok(service.submitProject(id));
    }

    @PostMapping("/{id}/review")
    @Operation(summary = "主管部门审核: true=进入UNDER_REVIEW, false=REJECTED")
    public R<CcerProject> review(@PathVariable String id,
                                  @RequestParam boolean approved,
                                  @RequestParam(required = false) String remark) {
        return R.ok(service.reviewProject(id, approved, remark));
    }

    @PostMapping("/{id}/record")
    @Operation(summary = "完成备案登记(UNDER_REVIEW→RECORDED)，必须先备案再审定")
    public R<CcerProject> record(@PathVariable String id,
                                 @RequestParam(required = false) String recordNo,
                                 @RequestParam(required = false) LocalDate recordDate) {
        return R.ok(service.recordProject(id, recordNo, recordDate));
    }

    @PostMapping("/{projectId}/validations")
    @Operation(summary = "提交DOE审定报告(RECORDED→VALIDATION_PASSED)，禁止跳过备案")
    public R<CcerValidation> submitValidation(@PathVariable String projectId,
                                              @RequestBody CcerValidation v) {
        return R.ok(service.submitValidation(projectId, v));
    }

    @GetMapping("/{projectId}/validations")
    @Operation(summary = "查询项目审定报告列表")
    public R<List<CcerValidation>> listValidations(@PathVariable String projectId) {
        return R.ok(service.listValidations(projectId));
    }

    @PostMapping("/{projectId}/verifications")
    @Operation(summary = "提交监测期核证报告(IMPLEMENTING→VERIFICATION_SUBMITTED)")
    public R<CcerVerification> submitVerification(@PathVariable String projectId,
                                                  @RequestBody CcerVerification v) {
        return R.ok(service.submitVerification(projectId, v));
    }

    @PostMapping("/verifications/{verificationId}/status")
    @Operation(summary = "更新核证状态 (VERIFIED=签发就绪)")
    public R<CcerVerification> updateVerificationStatus(
            @PathVariable String verificationId,
            @RequestParam CcerVerification.Status status) {
        return R.ok(service.updateVerificationStatus(verificationId, status));
    }

    @GetMapping("/{projectId}/verifications")
    @Operation(summary = "查询核证报告列表")
    public R<List<CcerVerification>> listVerifications(@PathVariable String projectId) {
        return R.ok(service.listVerifications(projectId));
    }

    @PostMapping("/{projectId}/issuances")
    @Operation(summary = "对VERIFIED核证签发减排量(默认扣2%缓冲储备)，可选择自动转入履约账户")
    public R<CcerIssuance> issue(@PathVariable String projectId,
                                 @RequestBody Map<String, Object> body) {
        String verificationId = (String) body.get("verificationId");
        boolean autoTransfer = body.containsKey("autoTransferToQuota")
                && Boolean.TRUE.equals(body.get("autoTransferToQuota"));
        return R.ok(service.issueCredits(projectId, verificationId, autoTransfer));
    }

    @GetMapping("/{projectId}/issuances")
    @Operation(summary = "查询某项目全部签发记录")
    public R<List<CcerIssuance>> listIssuances(@PathVariable String projectId) {
        return R.ok(service.listIssuances(projectId));
    }
}

@RestController
@RequestMapping("/ccer-issuances")
@RequiredArgsConstructor
@Tag(name = "CCER签发与流转", description = "签发量查询、转让、履约注销")
class CcerIssuanceController {
    private final CcerService service;

    @GetMapping
    @Operation(summary = "分页查询签发记录")
    public R<PageResult<CcerIssuance>> page(@ParameterObject PageQuery pq) {
        return R.ok(service.pageIssuances(pq));
    }

    @PostMapping("/{issuanceId}/transfer")
    @Operation(summary = "转让签发量(租户间交易)")
    public R<CcerIssuance> transfer(@PathVariable String issuanceId,
                                    @RequestBody Map<String, Object> body) {
        BigDecimal tons = new BigDecimal(body.get("tons").toString());
        String target = (String) body.get("targetTenantId");
        return R.ok(service.transferIssuance(issuanceId, tons, target));
    }

    @PostMapping("/{issuanceId}/retire")
    @Operation(summary = "注销签发量(履约抵消或公益注销)")
    public R<CcerIssuance> retire(@PathVariable String issuanceId,
                                  @RequestBody Map<String, Object> body) {
        BigDecimal tons = new BigDecimal(body.get("tons").toString());
        String note = (String) body.getOrDefault("note", "履约注销");
        return R.ok(service.retireIssuance(issuanceId, tons, note));
    }

    @GetMapping("/portfolio")
    @Operation(summary = "CCER资产总览(累计签发/可用/项目数量分布)")
    public R<Map<String, Object>> portfolio() {
        return R.ok(service.portfolio());
    }
}
