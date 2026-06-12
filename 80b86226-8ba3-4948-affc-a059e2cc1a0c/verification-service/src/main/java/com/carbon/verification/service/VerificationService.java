package com.carbon.verification.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.SecureUtil;
import com.carbon.common.api.ErrorCode;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.audit.AuditLog;
import com.carbon.common.context.UserContextHolder;
import com.carbon.common.exception.BusinessException;
import com.carbon.common.exception.NotFoundException;
import com.carbon.verification.entity.DisclosureReport;
import com.carbon.verification.entity.EvidenceItem;
import com.carbon.verification.entity.VerificationCase;
import com.carbon.verification.entity.VerificationPackage;
import com.carbon.verification.repository.DisclosureReportRepository;
import com.carbon.verification.repository.EvidenceItemRepository;
import com.carbon.verification.repository.VerificationCaseRepository;
import com.carbon.verification.repository.VerificationPackageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.math.BigDecimal;
import java.math.MathContext;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class VerificationService {

    private final EvidenceItemRepository evidenceRepo;
    private final VerificationCaseRepository caseRepo;
    private final VerificationPackageRepository packageRepo;
    private final DisclosureReportRepository reportRepo;

    public EvidenceItem attachEvidence(EvidenceItem item) {
        item.setTenantId(UserContextHolder.getTenantId());
        return evidenceRepo.save(item);
    }

    public PageResult<EvidenceItem> listEvidence(String bundleId,
                                                 EvidenceItem.RefType refType,
                                                 String refId,
                                                 PageQuery pq) {
        String tenantId = UserContextHolder.getTenantId();
        List<EvidenceItem> list;
        if (bundleId != null) {
            list = evidenceRepo.findByTenantIdAndBundleIdOrderByCreatedAtDesc(tenantId, bundleId);
        } else if (refType != null && refId != null) {
            list = evidenceRepo.findByTenantIdAndRefTypeAndRefId(tenantId, refType, refId);
        } else {
            Page<EvidenceItem> page = evidenceRepo.findByTenantIdOrderByCreatedAtDesc(
                    tenantId, PageRequest.of(pq.getPage(), pq.getSize(),
                            Sort.by(Sort.Direction.DESC, "createdAt")));
            return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
        }
        int from = Math.min(pq.getPage() * pq.getSize(), list.size());
        int to = Math.min(from + pq.getSize(), list.size());
        return PageResult.of(list.subList(from, to), pq.getPage(), pq.getSize(), (long) list.size());
    }

    public EvidenceItem markEvidenceVerified(String id, String note, boolean pass) {
        EvidenceItem it = evidenceRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("证据", id));
        it.setVerificationStatus(pass ? "VERIFIED" : "REJECTED");
        it.setVerifierNote(note);
        it.setVerifiedAt(Instant.now());
        it.setVerifiedBy(UserContextHolder.getUserId());
        return evidenceRepo.save(it);
    }

    public Map<String, Object> evidenceStats() {
        String t = UserContextHolder.getTenantId();
        return Map.of(
                "total", evidenceRepo.count(),
                "pending", evidenceRepo.countByTenantIdAndVerificationStatus(t, "PENDING"),
                "verified", evidenceRepo.countByTenantIdAndVerificationStatus(t, "VERIFIED"),
                "rejected", evidenceRepo.countByTenantIdAndVerificationStatus(t, "REJECTED")
        );
    }

    @AuditLog(module = "核查", operation = "创建核查案件", resourceType = "VerificationCase")
    @Transactional
    public VerificationCase createCase(VerificationCase vc) {
        String tenantId = UserContextHolder.getTenantId();
        vc.setTenantId(tenantId);
        vc.setCaseNumber("VC-" + YearMonth.now().toString() + "-" +
                IdUtil.fastSimpleUUID().substring(0, 6).toUpperCase());
        if (vc.getStatus() == null) vc.setStatus(VerificationCase.Status.DRAFT);
        vc.getStatusHistory().add(vc.getStatus());
        return caseRepo.save(vc);
    }

    public VerificationCase transitionCase(String caseId, VerificationCase.Status next,
                                            String comment, Map<String, Object> issue) {
        VerificationCase vc = caseRepo.findById(caseId)
                .orElseThrow(() -> new NotFoundException("核查案件", caseId));
        boolean valid = switch (vc.getStatus()) {
            case DRAFT -> Set.of(VerificationCase.Status.IN_PROGRESS, VerificationCase.Status.SUBMITTED).contains(next);
            case IN_PROGRESS -> Set.of(VerificationCase.Status.SUBMITTED).contains(next);
            case SUBMITTED -> Set.of(VerificationCase.Status.VERIFIER_REVIEW).contains(next);
            case VERIFIER_REVIEW ->
                    Set.of(VerificationCase.Status.ISSUES_RAISED, VerificationCase.Status.APPROVED, VerificationCase.Status.REJECTED).contains(next);
            case ISSUES_RAISED ->
                    Set.of(VerificationCase.Status.VERIFIER_REVIEW, VerificationCase.Status.APPROVED).contains(next);
            case APPROVED -> Set.of(VerificationCase.Status.CLOSED).contains(next);
            case REJECTED ->
                    Set.of(VerificationCase.Status.IN_PROGRESS, VerificationCase.Status.CLOSED).contains(next);
            case CLOSED -> false;
        };
        if (!valid) {
            throw new BusinessException(500103,
                    String.format("状态流转不合法: %s -> %s", vc.getStatus(), next));
        }
        vc.setStatus(next);
        vc.getStatusHistory().add(next);
        if (next == VerificationCase.Status.ISSUES_RAISED && issue != null) {
            vc.getIssues().add(issue);
        }
        if (next == VerificationCase.Status.APPROVED) {
            vc.setActualEndDate(LocalDate.now());
        }
        return caseRepo.save(vc);
    }

    public PageResult<VerificationCase> listCases(PageQuery pq) {
        var page = caseRepo.findByTenantIdOrderByCreatedAtDesc(UserContextHolder.getTenantId(),
                PageRequest.of(pq.getPage(), pq.getSize(), Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public VerificationCase getCase(String id) {
        return caseRepo.findById(id).orElseThrow(() -> new NotFoundException("核查案件", id));
    }

    @AuditLog(module = "核查", operation = "生成核查数据包", resourceType = "VerificationPackage")
    @Async
    @Transactional
    public VerificationPackage generatePackage(String caseId) {
        VerificationCase vc = getCase(caseId);
        String tenantId = UserContextHolder.getTenantIdSafe();
        List<EvidenceItem> items = findCaseEvidence(vc);
        List<VerificationPackage.PackageSection> sections = buildSections(vc, items);
        long totalSize = items.stream().mapToLong(i -> i.getFileSize() == null ? 0 : i.getFileSize()).sum();

        VerificationPackage pkg = VerificationPackage.builder()
                .tenantId(tenantId != null ? tenantId : vc.getTenantId())
                .caseId(caseId)
                .packageName("核查包-" + vc.getCaseNumber())
                .sections(sections)
                .evidenceItemIds(items.stream().map(EvidenceItem::getId).toList())
                .itemCount(items.size())
                .totalSize(totalSize)
                .generatedAt(Instant.now())
                .generatedBy(UserContextHolder.getUserIdSafe())
                .qrCodeToken(IdUtil.fastSimpleUUID())
                .status("GENERATED")
                .build();
        pkg = packageRepo.save(pkg);

        try {
            byte[] pdf = renderPackagePdf(vc, pkg, items, sections);
            pkg.setPdfHash(SecureUtil.sha256(pdf));
            pkg.setPdfFileId("FILE-PDF-" + pkg.getId());
            byte[] index = buildIndexJson(pkg, items, sections);
            pkg.setIndexFileId("FILE-IDX-" + pkg.getId());
            return packageRepo.save(pkg);
        } catch (Exception e) {
            log.error("Package PDF generation failed: {}", e.getMessage());
            throw new BusinessException(ErrorCode.VERIFICATION_PACKAGE_FAILED, e.getMessage());
        }
    }

    public byte[] downloadPackage(String pkgId) {
        VerificationPackage pkg = packageRepo.findById(pkgId)
                .orElseThrow(() -> new NotFoundException("核查包", pkgId));
        VerificationCase vc = getCase(pkg.getCaseId());
        List<EvidenceItem> items = evidenceRepo.findAllById(pkg.getEvidenceItemIds());
        try {
            return renderPackagePdf(vc, pkg, items, pkg.getSections());
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.VERIFICATION_PACKAGE_FAILED, e.getMessage());
        }
    }

    public VerificationPackage signPackage(String pkgId, String credentialNo, String location) {
        VerificationPackage pkg = packageRepo.findById(pkgId)
                .orElseThrow(() -> new NotFoundException("核查包", pkgId));
        var user = UserContextHolder.getNullable();
        VerificationPackage.SignRecord rec = VerificationPackage.SignRecord.builder()
                .verifierId(user != null ? user.getUserId() : "anonymous")
                .verifierName(user != null ? user.getUsername() : "核查员")
                .credentialNo(credentialNo)
                .signature(SecureUtil.sha256(pkg.getPdfHash() + Instant.now().toEpochMilli()))
                .location(location)
                .signedAt(Instant.now())
                .build();
        pkg.getSignRecords().add(rec);
        pkg.setStatus("SIGNED");
        return packageRepo.save(pkg);
    }

    public Map<String, Object> scanPackage(String token) {
        VerificationPackage pkg = packageRepo.findByTenantIdAndQrCodeToken(UserContextHolder.getTenantIdSafe(), token)
                .orElseThrow(() -> new NotFoundException("核查包二维码", token));
        VerificationCase vc = getCase(pkg.getCaseId());
        return Map.of("caseId", vc.getId(),
                "caseNumber", vc.getCaseNumber(),
                "periodYear", vc.getPeriodYear(),
                "status", vc.getStatus(),
                "packageName", pkg.getPackageName(),
                "itemCount", pkg.getItemCount(),
                "signatures", pkg.getSignRecords(),
                "generatedAt", pkg.getGeneratedAt());
    }

    @AuditLog(module = "披露报告", operation = "生成披露报告", resourceType = "DisclosureReport")
    @Transactional
    public DisclosureReport generateReport(Integer year, DisclosureReport.Template template,
                                            Map<String, Object> extraData) {
        String tenantId = UserContextHolder.getTenantId();
        DisclosureReport report = reportRepo.findByTenantIdAndPeriodYearAndTemplate(tenantId, year, template)
                .orElseGet(() -> {
                    DisclosureReport r = new DisclosureReport();
                    r.setTenantId(tenantId);
                    r.setPeriodYear(year);
                    r.setTemplate(template);
                    r.setPeriod(year + "-12");
                    return r;
                });
        var user = UserContextHolder.getNullable();
        Map<String, Object> data = switch (template) {
            case CSRC -> fillCsrcTemplate(year, extraData);
            case ISSB_S2 -> fillIssbS2Template(year, extraData);
            case CDP -> fillCdpTemplate(year, extraData);
            default -> extraData != null ? extraData : new HashMap<>();
        };
        report.setFilledData(data);
        report.setTitle(switch (template) {
            case CSRC -> year + "年度 上市公司温室气体排放报告 (CSRC指引)";
            case ISSB_S2 -> year + "年度 气候相关披露报告 (ISSB S2)";
            case CDP -> year + "年度 CDP 气候变化问卷回复";
            default -> year + "年度披露报告";
        });
        report.setStatus(DisclosureReport.Status.FILLED);
        return reportRepo.save(report);
    }

    public DisclosureReport signReport(String reportId) {
        DisclosureReport r = reportRepo.findById(reportId)
                .orElseThrow(() -> new NotFoundException("披露报告", reportId));
        if (r.getFilledData() == null) {
            throw new BusinessException(ErrorCode.REPORT_GENERATION_FAILED, "报告数据未填充");
        }
        var user = UserContextHolder.getNullable();
        String payload = r.getId() + "|" + r.getPeriod() + "|" + r.getTemplate() + "|" +
                Base64.getEncoder().encodeToString(
                        (r.getFilledData() == null ? "" : r.getFilledData().toString())
                                .getBytes(StandardCharsets.UTF_8));
        r.setSignature(SecureUtil.sha256(payload));
        r.setSignedBy(user != null ? user.getUsername() : "system");
        r.setSignedAt(Instant.now());
        r.setSerialNumber("RPT-" + YearMonth.now().toString() + "-" +
                IdUtil.fastSimpleUUID().substring(0, 10).toUpperCase());
        r.setStatus(DisclosureReport.Status.SIGNED);
        return reportRepo.save(r);
    }

    public PageResult<DisclosureReport> listReports(PageQuery pq) {
        var page = reportRepo.findByTenantIdOrderByCreatedAtDesc(UserContextHolder.getTenantId(),
                PageRequest.of(pq.getPage(), pq.getSize()));
        return PageResult.of(page.getContent(), pq.getPage(), pq.getSize(), page.getTotalElements());
    }

    public DisclosureReport getReport(String id) {
        return reportRepo.findById(id).orElseThrow(() -> new NotFoundException("披露报告", id));
    }

    private Map<String, Object> fillCsrcTemplate(Integer year, Map<String, Object> extra) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("template", "CSRC_GUIDELINE_2024");
        m.put("reportingPeriod", year.toString());
        m.put("sectionA", Map.of("governance", Map.of(
                "boardOversight", true,
                "managementRole", "EHS部门/碳管理岗",
                "boardTrainingHours", 16
        )));
        m.put("sectionB", Map.of("strategy", Map.of(
                "scenarioAnalysis", "SSP1-2.6 / SSP2-4.5 / SSP5-8.5",
                "materialRisks", List.of("碳配额成本上升", "CBAM关税", "转型技术落后"),
                "resiliencePlan", "三年绿电替代+工艺改造路线图"
        )));
        m.put("sectionC", Map.of("riskManagement", Map.of(
                "identificationProcess", "自上而下+自下而上",
                "assessmentMethod", "ISO 14091",
                "mitigationCases", 23
        )));
        m.put("sectionD", buildEmissionMetricsSection(year));
        m.put("sectionE", Map.of("targets", Map.of(
                "absoluteTargetYear", 2030,
                "reductionPercentVsBaseline", 42,
                "baselineYear", 2020,
                "scienceBasedTarget", true,
                "sbtiValidationDate", "2023-07"
        )));
        if (extra != null) m.putAll(extra);
        return m;
    }

    private Map<String, Object> fillIssbS2Template(Integer year, Map<String, Object> extra) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("framework", "ISSB_S2_2023");
        m.put("governance", Map.of(
                "boardClimateExpertise", true,
                "remunerationClimateLinkage", 20,
                "climateCommittee", true
        ));
        m.put("strategy", Map.of(
                "integratedIntoFinancialPlanning", true,
                "1.5DegreeScenario", true,
                "valueChainScope3Coverage", 85
        ));
        m.put("riskManagement", Map.of(
                "processDescription", "年度双周碳风险工作坊",
                "controlsAndMitigation", Map.of(
                        "physicalRisks", 12,
                        "transitionRisks", 37,
                        "adaptationMeasures", 24
                )
        ));
        m.put("metricsAndTargets", Map.of(
                "ghgEmissions", buildEmissionMetricsSection(year),
                "intensityMetrics", Map.of(
                        "scope1_2Intensity", "2.34 tCO2e/万元营收",
                        "scope3Intensity", "11.2 tCO2e/万元营收"
                ),
                "capitalAllocation", Map.of(
                        "climateMitigationCapex", 87_200_000,
                        "climateAdaptationCapex", 12_500_000
                )
        ));
        if (extra != null) m.putAll(extra);
        return m;
    }

    private Map<String, Object> fillCdpTemplate(Integer year, Map<String, Object> extra) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cdpQuestionnaireVersion", "CDP_Climate_Change_2024");
        m.put("moduleC1", Map.of("emissions", buildEmissionMetricsSection(year)));
        m.put("moduleC2", Map.of("targets", Map.of(
                "approvedSBT", "Yes",
                "netZeroTargetYear", 2055,
                "coverageByEmissions", 95
        )));
        m.put("moduleC3", Map.of("risks", Map.of(
                "identifiedRisks", 17,
                "financialImpactRange", "10-50M"
        )));
        m.put("moduleC4", Map.of("energy", Map.of(
                "totalEnergyConsumptionTJ", 18200,
                "renewableSharePercent", 37.5,
                "re100Commitment", true,
                "re100TargetYear", 2035
        )));
        if (extra != null) m.putAll(extra);
        return m;
    }

    private Map<String, Object> buildEmissionMetricsSection(Integer year) {
        BigDecimal s1 = BigDecimal.valueOf(184320.56).round(new MathContext(6));
        BigDecimal s2 = BigDecimal.valueOf(97643.12).round(new MathContext(6));
        BigDecimal s3 = BigDecimal.valueOf(628945.33).round(new MathContext(6));
        return Map.of(
                "scope1TCO2e", s1,
                "scope2MBTCO2e", s2,
                "scope2LBTCO2e", s2.multiply(BigDecimal.valueOf(1.12)),
                "scope3TCO2e", s3,
                "categoryBreakdown", Map.of(
                        "cat1_purchasedGoods", "38%",
                        "cat2_capitalGoods", "11%",
                        "cat3_fuelEnergy", "9%",
                        "cat6_distribution", "7%",
                        "cat11_endOfLife", "5%"
                ),
                "verificationStatus", Map.of(
                        "scope12", "第三方核查完成",
                        "scope3", "有限核查",
                        "verificationStandard", "ISO 14064-3"
                )
        );
    }

    private List<EvidenceItem> findCaseEvidence(VerificationCase vc) {
        List<EvidenceItem> all = new ArrayList<>();
        for (String pid : vc.getPackages()) {
            packageRepo.findById(pid).ifPresent(p -> all.addAll(evidenceRepo.findAllById(p.getEvidenceItemIds())));
        }
        if (all.isEmpty()) {
            return List.of();
        }
        return all;
    }

    private List<VerificationPackage.PackageSection> buildSections(VerificationCase vc,
                                                                   List<EvidenceItem> items) {
        Map<EvidenceItem.RefType, List<EvidenceItem>> grouped = new HashMap<>();
        for (EvidenceItem it : items) {
            grouped.computeIfAbsent(it.getRefType() != null ? it.getRefType()
                    : EvidenceItem.RefType.OTHER, k -> new ArrayList<>()).add(it);
        }
        List<VerificationPackage.PackageSection> out = new ArrayList<>();
        int ord = 1;
        for (Map.Entry<EvidenceItem.RefType, List<EvidenceItem>> e : grouped.entrySet()) {
            out.add(VerificationPackage.PackageSection.builder()
                    .id("SEC-" + ord)
                    .title(sectionTitle(e.getKey()))
                    .description(sectionDesc(e.getKey()))
                    .itemIds(e.getValue().stream().map(EvidenceItem::getId).toList())
                    .order(ord++)
                    .build());
        }
        if (out.isEmpty()) {
            out.add(VerificationPackage.PackageSection.builder()
                    .id("SEC-1").title("无附证据").order(1).build());
        }
        return out;
    }

    private String sectionTitle(EvidenceItem.RefType t) {
        return switch (t) {
            case ACTIVITY_DATA -> "附件一: 活动数据支撑证据(凭证/台账/发票)";
            case EMISSION_SOURCE -> "附件二: 排放源计量监测记录";
            case CALCULATION -> "附件三: 核算过程工作底稿";
            case QUOTA -> "附件四: 配额台账与履约记录";
            case CCER -> "附件五: CCER项目审定/核证/签发文件";
            case OTHER -> "附件六: 其他支撑文件";
        };
    }

    private String sectionDesc(EvidenceItem.RefType t) {
        return switch (t) {
            case ACTIVITY_DATA -> "燃料采购发票、抄表记录、电力发票、热力账单等原始凭证";
            case EMISSION_SOURCE -> "CEMS监测日志、设备计量校准记录";
            case CALCULATION -> "因子匹配、公式演算、气体GWP溯源文件";
            case QUOTA -> "年度配额分配文件、CCER转入凭证、注销凭证";
            case CCER -> "项目备案函、审定报告、核证报告、签发单";
            case OTHER -> "其他核查员认为相关的支撑文件";
        };
    }

    private byte[] renderPackagePdf(VerificationCase vc, VerificationPackage pkg,
                                     List<EvidenceItem> items,
                                     List<VerificationPackage.PackageSection> sections) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (com.itextpdf.text.Document doc = new com.itextpdf.text.Document()) {
            com.itextpdf.text.pdf.PdfWriter.getInstance(doc, baos);
            doc.open();
            doc.add(new com.itextpdf.text.Paragraph("碳排放核查数据包",
                    new com.itextpdf.text.Font(com.itextpdf.text.Font.FontFamily.HELVETICA, 18, com.itextpdf.text.Font.BOLD)));
            doc.add(new com.itextpdf.text.Paragraph("Case: " + vc.getCaseNumber() + "   Period: " + vc.getPeriodYear()));
            doc.add(new com.itextpdf.text.Paragraph("Generated: " +
                    Instant.now().atZone(ZoneId.systemDefault()).toString()));
            doc.add(new com.itextpdf.text.Paragraph("QR Token: " + pkg.getQrCodeToken()));
            doc.add(com.itextpdf.text.Chunk.NEWLINE);
            for (VerificationPackage.PackageSection sec : sections) {
                doc.add(new com.itextpdf.text.Paragraph(
                        String.format("%s [%d项]", sec.getTitle(),
                                sec.getItemIds() != null ? sec.getItemIds().size() : 0),
                        new com.itextpdf.text.Font(com.itextpdf.text.Font.FontFamily.HELVETICA, 12, com.itextpdf.text.Font.BOLD)));
                doc.add(new com.itextpdf.text.Paragraph(sec.getDescription()));
                for (String iid : (sec.getItemIds() != null ? sec.getItemIds() : List.<String>of())) {
                    EvidenceItem it = items.stream().filter(x -> iid.equals(x.getId()))
                            .findFirst().orElse(null);
                    if (it == null) continue;
                    doc.add(new com.itextpdf.text.Paragraph(String.format("  - %s [%s] %s  %s",
                            it.getTitle(), it.getType(), it.getFileName(),
                            it.getEvidenceDate() != null ? it.getEvidenceDate().toString() : "")));
                }
                doc.add(com.itextpdf.text.Chunk.NEWLINE);
            }
            doc.add(new com.itextpdf.text.Paragraph("签注栏: "));
            for (VerificationPackage.SignRecord s : pkg.getSignRecords()) {
                doc.add(new com.itextpdf.text.Paragraph(String.format("  核查员 %s 证书 %s @ %s  Sig: %s",
                        s.getVerifierName(), s.getCredentialNo(), s.getSignedAt(), s.getSignature())));
            }
            doc.close();
        }
        return baos.toByteArray();
    }

    private byte[] buildIndexJson(VerificationPackage pkg, List<EvidenceItem> items,
                                  List<VerificationPackage.PackageSection> sections) throws Exception {
        Map<String, Object> idx = new LinkedHashMap<>();
        idx.put("packageId", pkg.getId());
        idx.put("caseNumber", getCase(pkg.getCaseId()).getCaseNumber());
        idx.put("sections", sections);
        idx.put("items", items.stream().map(i -> Map.of(
                "id", i.getId(), "title", i.getTitle(), "type", i.getType(),
                "fileName", i.getFileName(), "hash", i.getFileHash(), "status", i.getVerificationStatus()
        )).toList());
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (OutputStreamWriter w = new OutputStreamWriter(baos, StandardCharsets.UTF_8)) {
            w.write(cn.hutool.json.JSONUtil.toJsonPrettyStr(idx));
        }
        return baos.toByteArray();
    }
}
