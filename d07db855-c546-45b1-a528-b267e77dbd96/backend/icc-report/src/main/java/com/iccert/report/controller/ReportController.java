package com.iccert.report.controller;

import com.iccert.common.result.R;
import com.iccert.report.entity.*;
import com.iccert.report.service.CertificateService;
import com.iccert.report.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "报告证书", description = "报告模板引擎、自动生成、批注、证书签发、续证提醒、电子签章")
@RestController
@RequestMapping
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final CertificateService certificateService;

    @Operation(summary = "获取所有报告模板")
    @GetMapping("/report/templates")
    public R<List<ReportTemplate>> listReportTemplates() {
        return R.ok(reportService.listTemplates());
    }

    @Operation(summary = "自动生成检测报告(模板渲染+字段映射+自动判定)")
    @PostMapping("/report/generate")
    public R<InspectionReport> generateReport(@RequestBody Map<String, Object> params,
                                              HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        Long templateId = Long.valueOf(params.get("templateId").toString());
        Long sampleId = Long.valueOf(params.get("sampleId").toString());
        Long companyId = Long.valueOf(params.get("companyId").toString());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) params.get("testItems");
        return R.ok(reportService.generateReport(templateId, sampleId,
                (String) params.get("sampleName"), companyId,
                (String) params.get("companyName"), (String) params.get("certTypeCode"),
                items, userId, username));
    }

    @Operation(summary = "审核报告")
    @PostMapping("/report/{id}/audit")
    public R<InspectionReport> auditReport(@PathVariable Long id,
                                           @RequestParam String status,
                                           @RequestParam(required = false) String remark,
                                           HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(reportService.auditReport(id, status, remark, userId, username));
    }

    @Operation(summary = "获取报告批注列表")
    @GetMapping("/report/{id}/annotations")
    public R<List<ReportAnnotation>> getAnnotations(@PathVariable Long id) {
        return R.ok(reportService.getReportAnnotations(id));
    }

    @Operation(summary = "添加报告批注")
    @PostMapping("/report/{id}/annotation")
    public R<ReportAnnotation> addAnnotation(@PathVariable Long id,
                                             @RequestBody ReportAnnotation ann,
                                             HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        ann.setReportId(id);
        return R.ok(reportService.addAnnotation(ann, userId, username));
    }

    @Operation(summary = "获取所有报告")
    @GetMapping("/report/list")
    public R<List<InspectionReport>> listReports() {
        return R.ok(reportService.listReports());
    }

    @Operation(summary = "获取所有证书模板")
    @GetMapping("/certificate/templates")
    public R<List<CertificateTemplate>> listCertTemplates() {
        return R.ok(certificateService.listTemplates());
    }

    @Operation(summary = "签发认证证书")
    @PostMapping("/certificate/issue")
    public R<CertificateInfo> issueCert(@RequestBody Map<String, Object> params,
                                        HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(certificateService.issueCertificate(
                Long.valueOf(params.get("templateId").toString()),
                Long.valueOf(params.get("companyId").toString()),
                (String) params.get("companyName"),
                (String) params.get("productName"),
                (String) params.get("productModel"),
                (String) params.get("standardCode"),
                Long.valueOf(params.get("certTypeId").toString()),
                (String) params.get("certTypeCode"),
                params.get("validYears") != null ? Integer.valueOf(params.get("validYears").toString()) : 3,
                params.get("reportId") != null ? Long.valueOf(params.get("reportId").toString()) : null,
                (String) params.get("reportCode"),
                userId, username));
    }

    @Operation(summary = "撤销证书")
    @PostMapping("/certificate/{id}/revoke")
    public R<CertificateInfo> revokeCert(@PathVariable Long id,
                                         @RequestParam String reason,
                                         HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(certificateService.revokeCertificate(id, reason, userId, username));
    }

    @Operation(summary = "批量打印证书")
    @PostMapping("/certificate/batch-print")
    public R<List<Map<String, Object>>> batchPrint(@RequestBody List<Long> certIds) {
        return R.ok(certificateService.batchPrintCertificates(certIds));
    }

    @Operation(summary = "获取证书变更记录")
    @GetMapping("/certificate/{id}/changelogs")
    public R<List<CertificateChangeLog>> getChangeLogs(@PathVariable Long id) {
        return R.ok(certificateService.getChangeLogs(id));
    }

    @Operation(summary = "获取所有证书")
    @GetMapping("/certificate/list")
    public R<List<CertificateInfo>> listCertificates() {
        return R.ok(certificateService.listCertificates());
    }
}
