package com.iccert.report.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iccert.common.exception.BusinessException;
import com.iccert.common.utils.CodeGenerator;
import com.iccert.report.entity.*;
import com.iccert.report.mapper.*;
import freemarker.template.Configuration;
import freemarker.template.Template;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.StringWriter;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final InspectionReportMapper reportMapper;
    private final ReportTemplateMapper templateMapper;
    private final ReportRevisionMapper revisionMapper;
    private final ReportAnnotationMapper annotationMapper;
    private final Configuration freemarkerConfig;
    private final ObjectMapper objectMapper;
    private final PdfService pdfService;

    @Transactional
    public InspectionReport generateReport(Long templateId, Long sampleId, String sampleName,
                                           Long companyId, String companyName, String certTypeCode,
                                           List<Map<String, Object>> testItems, Long authorId, String authorName) {
        ReportTemplate tpl = templateMapper.selectById(templateId);
        if (tpl == null) tpl = templateMapper.selectOne(
                new LambdaQueryWrapper<ReportTemplate>().eq(ReportTemplate::getIsDefault, 1));
        if (tpl == null) throw new BusinessException("报告模板不存在");

        Map<String, Object> data = buildReportData(sampleId, sampleName, companyId, companyName,
                certTypeCode, testItems, tpl);
        applyCalculationRules(data, tpl);
        String renderedHtml = renderTemplate(tpl.getTemplateContent(), data);
        String overallResult = autoJudge(testItems);
        data.put("overallResult", overallResult);
        renderedHtml = applyConditionRender(renderedHtml, data);

        InspectionReport report = new InspectionReport();
        report.setReportCode(CodeGenerator.genReportCode());
        report.setReportTitle(sampleName + "检测报告");
        report.setSampleId(sampleId);
        report.setCompanyId(companyId);
        report.setCompanyName(companyName);
        report.setCertTypeCode(certTypeCode);
        report.setTemplateId(tpl.getId());
        report.setTemplateVersion(tpl.getVersion());
        report.setReportContent(renderedHtml);
        report.setReportStatus("DRAFT");
        report.setReportVersion("V1.0");
        report.setOverallResult(overallResult);
        report.setAuthorId(authorId);
        report.setAuthorName(authorName);
        reportMapper.insert(report);

        saveRevision(report.getId(), "V1.0", "CREATE", "报告自动生成", authorId, authorName);
        log.info("报告已生成: {}, 判定结果: {}", report.getReportCode(), overallResult);
        return report;
    }

    private Map<String, Object> buildReportData(Long sampleId, String sampleName, Long companyId,
                                                 String companyName, String certTypeCode,
                                                 List<Map<String, Object>> testItems, ReportTemplate tpl) {
        Map<String, Object> data = new HashMap<>();
        data.put("reportCode", CodeGenerator.genReportCode());
        data.put("sampleId", sampleId);
        data.put("sampleName", sampleName);
        data.put("companyId", companyId);
        data.put("companyName", companyName);
        data.put("certTypeCode", certTypeCode);
        data.put("issueDate", LocalDate.now().toString());
        data.put("testItems", testItems != null ? testItems : new ArrayList<>());
        try {
            if (tpl.getFieldMapping() != null && !tpl.getFieldMapping().isEmpty()) {
                Map<String, Object> mapping = objectMapper.readValue(tpl.getFieldMapping(), Map.class);
                data.putAll(mapping);
            }
        } catch (Exception e) {
            log.warn("解析字段映射配置失败", e);
        }
        return data;
    }

    private void applyCalculationRules(Map<String, Object> data, ReportTemplate tpl) {
        try {
            if (tpl.getCalculationRules() == null || tpl.getCalculationRules().isEmpty()) return;
            List<Map<String, Object>> rules = objectMapper.readValue(tpl.getCalculationRules(), List.class);
            for (Map<String, Object> rule : rules) {
                String target = (String) rule.get("target");
                String formula = (String) rule.get("formula");
                if ("overallResult".equals(target)) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("testItems");
                    data.put("overallResult", autoJudge(items));
                }
            }
        } catch (Exception e) {
            log.warn("执行自动计算规则失败", e);
        }
    }

    private String autoJudge(List<Map<String, Object>> testItems) {
        if (testItems == null || testItems.isEmpty()) return "PENDING";
        boolean allPass = testItems.stream()
                .filter(i -> i.get("result_judgment") != null)
                .allMatch(i -> "PASS".equals(i.get("result_judgment")));
        boolean anyFail = testItems.stream()
                .anyMatch(i -> "FAIL".equals(i.get("result_judgment")));
        if (anyFail) return "FAIL";
        if (allPass) return "PASS";
        return "PENDING";
    }

    private String applyConditionRender(String html, Map<String, Object> data) {
        if ("PASS".equals(data.get("overallResult"))) {
            html = html.replace("${showPassStamp}", "<div class='pass-stamp'>合格</div>");
            html = html.replace("${showFailStamp}", "");
        } else if ("FAIL".equals(data.get("overallResult"))) {
            html = html.replace("${showPassStamp}", "");
            html = html.replace("${showFailStamp}", "<div class='fail-stamp'>不合格</div>");
        } else {
            html = html.replace("${showPassStamp}", "").replace("${showFailStamp}", "");
        }
        return html;
    }

    private String renderTemplate(String tplContent, Map<String, Object> data) {
        try {
            Template tpl = new Template("report", new java.io.StringReader(tplContent), freemarkerConfig);
            StringWriter w = new StringWriter();
            tpl.process(data, w);
            return w.toString();
        } catch (Exception e) {
            log.warn("FreeMarker渲染失败, 使用简单替换", e);
            String result = tplContent;
            for (Map.Entry<String, Object> e : data.entrySet()) {
                if (e.getValue() != null && !(e.getValue() instanceof List) && !(e.getValue() instanceof Map)) {
                    result = result.replace("${" + e.getKey() + "}", e.getValue().toString());
                }
            }
            return result;
        }
    }

    @Transactional
    public InspectionReport auditReport(Long reportId, String status, String remark,
                                        Long reviewerId, String reviewerName) {
        InspectionReport report = reportMapper.selectById(reportId);
        if (report == null) throw new BusinessException("报告不存在");
        report.setReportStatus(status);
        report.setReviewerId(reviewerId);
        report.setReviewerName(reviewerName);
        report.setReviewRemark(remark);
        report.setReviewTime(LocalDateTime.now());
        if ("ISSUED".equals(status)) {
            report.setIssueTime(LocalDateTime.now());
            report.setApproverId(reviewerId);
            report.setApproverName(reviewerName);
        }
        reportMapper.updateById(report);
        saveRevision(reportId, report.getReportVersion(),
                "REVIEW".equals(status) ? "REVIEW" : ("ISSUED".equals(status) ? "APPROVE" : "EDIT"),
                remark, reviewerId, reviewerName);
        return report;
    }

    public List<ReportAnnotation> getReportAnnotations(Long reportId) {
        return annotationMapper.selectList(new LambdaQueryWrapper<ReportAnnotation>()
                .eq(ReportAnnotation::getReportId, reportId)
                .orderByAsc(ReportAnnotation::getCreateTime));
    }

    @Transactional
    public ReportAnnotation addAnnotation(ReportAnnotation ann, Long annotatorId, String annotatorName) {
        ann.setAnnotatorId(annotatorId);
        ann.setAnnotatorName(annotatorName);
        annotationMapper.insert(ann);
        return ann;
    }

    private void saveRevision(Long reportId, String version, String type, String remark,
                              Long operatorId, String operatorName) {
        ReportRevision rev = new ReportRevision();
        rev.setReportId(reportId);
        rev.setReportVersion(version);
        rev.setRevisionType(type);
        rev.setRevisionRemark(remark);
        rev.setOperatorId(operatorId);
        rev.setOperatorName(operatorName);
        revisionMapper.insert(rev);
    }

    public List<ReportTemplate> listTemplates() {
        return templateMapper.selectList(null);
    }

    public List<InspectionReport> listReports() {
        return reportMapper.selectList(null);
    }

    /**
     * 生成报告 PDF（基于结构化数据，使用 OpenPDF 渲染，替代 HTML 模拟）。
     */
    public byte[] generateReportPdf(Long reportId) {
        InspectionReport report = reportMapper.selectById(reportId);
        if (report == null) throw new BusinessException("报告不存在");
        byte[] pdfBytes = pdfService.generateReportPdf(report);
        if (report.getReportPdfUrl() == null || report.getReportPdfUrl().isEmpty()) {
            report.setReportPdfUrl("/report/" + reportId + "/pdf");
            reportMapper.updateById(report);
        }
        return pdfBytes;
    }
}
