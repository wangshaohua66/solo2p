package com.carbon.verification.controller;

import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.verification.entity.DisclosureReport;
import com.carbon.verification.entity.EvidenceItem;
import com.carbon.verification.entity.VerificationCase;
import com.carbon.verification.entity.VerificationPackage;
import com.carbon.verification.service.VerificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/evidence")
@RequiredArgsConstructor
@Tag(name = "证据链管理", description = "凭证/监测/台账/检测报告挂证据")
class EvidenceController {
    private final VerificationService service;

    @PostMapping("/upload")
    @Operation(summary = "上传证据文件(元数据入库, fileId指向对象存储)")
    public R<EvidenceItem> upload(
            @Parameter(description = "关联类型: ACTIVITY_DATA/EMISSION_SOURCE/CALCULATION/QUOTA/CCER")
            @RequestParam EvidenceItem.RefType refType,
            @Parameter(description = "关联数据ID") @RequestParam String refId,
            @Parameter(description = "证据类型") @RequestParam EvidenceItem.Type type,
            @Parameter(description = "证据标题") @RequestParam String title,
            @RequestParam(required = false) String bundleId,
            @RequestParam("file") MultipartFile file) throws IOException {
        EvidenceItem ev = EvidenceItem.builder()
                .bundleId(bundleId)
                .refType(refType)
                .refId(refId)
                .type(type)
                .title(title)
                .fileName(file.getOriginalFilename())
                .fileSize(file.getSize())
                .fileHash(cn.hutool.crypto.SecureUtil.sha256(file.getBytes()))
                .mimeType(file.getContentType())
                .evidenceDate(Instant.now())
                .build();
        return R.ok(service.attachEvidence(ev));
    }

    @PostMapping("/items")
    @Operation(summary = "创建证据元数据(文件已预上传)")
    public R<EvidenceItem> create(@RequestBody EvidenceItem item) {
        return R.ok(service.attachEvidence(item));
    }

    @GetMapping
    @Operation(summary = "分页查询证据列表(bundleId或refType+refId二选一)")
    public R<PageResult<EvidenceItem>> list(
            @RequestParam(required = false) String bundleId,
            @RequestParam(required = false) EvidenceItem.RefType refType,
            @RequestParam(required = false) String refId,
            @ParameterObject PageQuery pq) {
        return R.ok(service.listEvidence(bundleId, refType, refId, pq));
    }

    @PostMapping("/{id}/verify")
    @Operation(summary = "核查员签注证据")
    public R<EvidenceItem> verify(@PathVariable String id,
                                  @RequestBody Map<String, Object> body) {
        String note = (String) body.getOrDefault("note", "");
        boolean pass = Boolean.TRUE.equals(body.get("pass"));
        return R.ok(service.markEvidenceVerified(id, note, pass));
    }

    @GetMapping("/stats")
    @Operation(summary = "证据量及状态统计")
    public R<Map<String, Object>> stats() {
        return R.ok(service.evidenceStats());
    }
}

@RestController
@RequestMapping("/verifications")
@RequiredArgsConstructor
@Tag(name = "核查案件与数据包", description = "案件创建、状态流转、核查包生成PDF与扫码签注")
class VerificationCaseController {
    private final VerificationService service;

    @PostMapping("/cases")
    @Operation(summary = "创建核查案件")
    public R<VerificationCase> createCase(@RequestBody VerificationCase vc) {
        return R.ok(service.createCase(vc));
    }

    @GetMapping("/cases")
    @Operation(summary = "分页查询核查案件")
    public R<PageResult<VerificationCase>> listCases(@ParameterObject PageQuery pq) {
        return R.ok(service.listCases(pq));
    }

    @GetMapping("/cases/{id}")
    @Operation(summary = "获取案件详情")
    public R<VerificationCase> getCase(@PathVariable String id) {
        return R.ok(service.getCase(id));
    }

    @PostMapping("/cases/{id}/transition")
    @Operation(summary = "案件状态流转(严格状态机校验)")
    public R<VerificationCase> transition(@PathVariable String id,
                                           @RequestBody Map<String, Object> body) {
        VerificationCase.Status next = VerificationCase.Status.valueOf((String) body.get("next"));
        String comment = (String) body.getOrDefault("comment", "");
        @SuppressWarnings("unchecked")
        Map<String, Object> issue = (Map<String, Object>) body.get("issue");
        return R.ok(service.transitionCase(id, next, comment, issue));
    }

    @PostMapping("/cases/{caseId}/packages")
    @Operation(summary = "异步生成核查数据包(PDF+索引+QR Token,供现场扫码)")
    public R<VerificationPackage> generatePackage(@PathVariable String caseId) {
        return R.ok(service.generatePackage(caseId));
    }

    @GetMapping("/packages/{pkgId}/download")
    @Operation(summary = "下载核查数据包PDF")
    public void downloadPackage(@PathVariable String pkgId, HttpServletResponse resp) throws IOException {
        byte[] bytes = service.downloadPackage(pkgId);
        resp.setContentType(MediaType.APPLICATION_PDF_VALUE);
        resp.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=verification-package-" + pkgId + ".pdf");
        resp.getOutputStream().write(bytes);
    }

    @PostMapping("/packages/{pkgId}/sign")
    @Operation(summary = "核查员现场签注(扫码后签名写入核查包)")
    public R<VerificationPackage> sign(@PathVariable String pkgId,
                                        @RequestBody Map<String, Object> body) {
        String credentialNo = (String) body.get("credentialNo");
        String location = (String) body.getOrDefault("location", "");
        return R.ok(service.signPackage(pkgId, credentialNo, location));
    }

    @GetMapping("/packages/scan/{token}")
    @Operation(summary = "核查包二维码扫码入口(无需登录,返回包信息)")
    public R<Map<String, Object>> scan(@PathVariable String token) {
        return R.ok(service.scanPackage(token));
    }
}

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@Tag(name = "披露报告", description = "CSRC/ISSB S2/CDP三模板自动填充+数字签名")
class DisclosureReportController {
    private final VerificationService service;

    @PostMapping("/generate")
    @Operation(summary = "按模板生成年度披露报告(自动填充数据)")
    public R<DisclosureReport> generate(
            @Parameter(required = true, example = "2024") @RequestParam Integer year,
            @Parameter(required = true, description = "CSRC/ISSB_S2/CDP")
            @RequestParam DisclosureReport.Template template,
            @RequestBody(required = false) Map<String, Object> extraData) {
        return R.ok(service.generateReport(year, template, extraData));
    }

    @PostMapping("/{reportId}/sign")
    @Operation(summary = "对披露报告添加数字签名(SHA-256摘要+序列号)")
    public R<DisclosureReport> sign(@PathVariable String reportId) {
        return R.ok(service.signReport(reportId));
    }

    @GetMapping
    @Operation(summary = "分页查询披露报告列表")
    public R<PageResult<DisclosureReport>> list(@ParameterObject PageQuery pq) {
        return R.ok(service.listReports(pq));
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询报告详情(含填充数据、签名、序列号)")
    public R<DisclosureReport> get(@PathVariable String id) {
        return R.ok(service.getReport(id));
    }
}
