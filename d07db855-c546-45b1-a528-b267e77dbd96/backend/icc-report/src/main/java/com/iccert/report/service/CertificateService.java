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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.StringWriter;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateService {

    private final CertificateInfoMapper certMapper;
    private final CertificateTemplateMapper certTemplateMapper;
    private final CertificateChangeLogMapper changeLogMapper;
    private final Configuration freemarkerConfig;
    private final ObjectMapper objectMapper;
    private final PdfService pdfService;

    @org.springframework.beans.factory.annotation.Value("${certificate.signature.image-url:}")
    private String defaultSignatureImageUrl;

    @Transactional
    public CertificateInfo issueCertificate(Long templateId, Long companyId, String companyName,
                                            String productName, String productModel, String standardCode,
                                            Long certTypeId, String certTypeCode, Integer validYears,
                                            Long reportId, String reportCode, Long issuerId, String issuerName) {
        CertificateTemplate tpl = certTemplateMapper.selectById(templateId);
        if (tpl == null) tpl = certTemplateMapper.selectOne(
                new LambdaQueryWrapper<CertificateTemplate>().eq(CertificateTemplate::getCertTypeId, certTypeId));
        if (tpl == null) throw new BusinessException("证书模板不存在");

        Map<String, Object> data = new HashMap<>();
        String certNo = CodeGenerator.genCertNo(certTypeCode);
        data.put("certNo", certNo);
        data.put("companyName", companyName);
        data.put("productName", productName);
        data.put("productModel", productModel != null ? productModel : "");
        data.put("standardCode", standardCode != null ? standardCode : "");
        data.put("certTypeCode", certTypeCode);
        data.put("issueDate", LocalDate.now().toString());
        LocalDate expire = LocalDate.now().plusYears(validYears != null ? validYears : 3);
        data.put("expireDate", expire.toString());
        data.put("issuerName", issuerName);
        data.put("validYears", validYears != null ? validYears : 3);

        String renderedHtml = renderTemplate(tpl.getTemplateContent(), data);

        CertificateInfo cert = new CertificateInfo();
        cert.setCertNo(certNo);
        cert.setCertTypeId(certTypeId);
        cert.setCertTypeCode(certTypeCode);
        cert.setCompanyId(companyId);
        cert.setCompanyName(companyName);
        cert.setProductName(productName);
        cert.setProductModel(productModel);
        cert.setStandardCode(standardCode);
        cert.setReportId(reportId);
        cert.setReportCode(reportCode);
        cert.setTemplateId(tpl.getId());
        cert.setCertContent(renderedHtml);
        cert.setCertStatus("VALID");
        cert.setIssueDate(LocalDate.now());
        cert.setExpireDate(expire);
        cert.setValidYears(validYears != null ? validYears : 3);
        cert.setIssuerId(issuerId);
        cert.setIssuerName(issuerName);
        cert.setIsReminderSent(0);
        cert.setSignatureUrl(defaultSignatureImageUrl.isEmpty() ? null : defaultSignatureImageUrl);
        certMapper.insert(cert);

        // 生成证书PDF并叠加电子签章（真实叠加到PDF，非仅存配置JSON）
        try {
            pdfService.generateCertificatePdfWithSignature(cert, cert.getSignatureUrl());
            cert.setCertPdfUrl("/certificate/" + cert.getId() + "/pdf");
            certMapper.updateById(cert);
            log.info("证书PDF已生成并叠加电子签章: {}", certNo);
        } catch (Exception e) {
            log.warn("证书PDF生成失败, 仅存储HTML内容: {}", certNo, e);
        }

        saveChangeLog(cert.getId(), certNo, "ISSUE", null, objectMapper.valueToTree(cert).toString(),
                "首次签发证书", issuerId, issuerName);
        log.info("证书已签发: {}, 类型: {}, 到期: {}", certNo, certTypeCode, expire);
        return cert;
    }

    @Transactional
    public CertificateInfo revokeCertificate(Long certId, String reason, Long operatorId, String operatorName) {
        CertificateInfo cert = certMapper.selectById(certId);
        if (cert == null) throw new BusinessException("证书不存在");
        String before = objectMapper.valueToTree(cert).toString();
        cert.setCertStatus("REVOKED");
        cert.setRevokeTime(LocalDateTime.now());
        cert.setRevokeReason(reason);
        certMapper.updateById(cert);
        saveChangeLog(certId, cert.getCertNo(), "REVOKE", before,
                objectMapper.valueToTree(cert).toString(), reason, operatorId, operatorName);
        log.warn("证书已撤销: {}, 原因: {}", cert.getCertNo(), reason);
        return cert;
    }

    public List<Map<String, Object>> batchPrintCertificates(List<Long> certIds) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Long id : certIds) {
            CertificateInfo cert = certMapper.selectById(id);
            if (cert != null) {
                Map<String, Object> r = new HashMap<>();
                r.put("certId", id);
                r.put("certNo", cert.getCertNo());
                r.put("htmlContent", cert.getCertContent());
                r.put("pdfUrl", cert.getCertPdfUrl());
                r.put("printStatus", "READY");
                result.add(r);
            }
        }
        log.info("批量打印证书: {}份", result.size());
        return result;
    }

    private String renderTemplate(String tplContent, Map<String, Object> data) {
        try {
            Template tpl = new Template("cert", new java.io.StringReader(tplContent), freemarkerConfig);
            StringWriter w = new StringWriter();
            tpl.process(data, w);
            return w.toString();
        } catch (Exception e) {
            String result = tplContent;
            for (Map.Entry<String, Object> e : data.entrySet()) {
                if (e.getValue() != null) {
                    result = result.replace("${" + e.getKey() + "}", e.getValue().toString());
                }
            }
            return result;
        }
    }

    private void saveChangeLog(Long certId, String certNo, String type, String before,
                               String after, String reason, Long operatorId, String operatorName) {
        CertificateChangeLog log = new CertificateChangeLog();
        log.setCertificateId(certId);
        log.setCertNo(certNo);
        log.setChangeType(type);
        log.setChangeBefore(before);
        log.setChangeAfter(after);
        log.setChangeReason(reason);
        log.setOperatorId(operatorId);
        log.setOperatorName(operatorName);
        changeLogMapper.insert(log);
    }

    public List<CertificateInfo> listCertificates() {
        return certMapper.selectList(null);
    }

    /**
     * 生成证书 PDF（含电子签章叠加）。
     */
    public byte[] generateCertificatePdf(Long certId) {
        CertificateInfo cert = certMapper.selectById(certId);
        if (cert == null) throw new BusinessException("证书不存在");
        String signUrl = cert.getSignatureUrl() != null ? cert.getSignatureUrl() : defaultSignatureImageUrl;
        return pdfService.generateCertificatePdfWithSignature(cert, signUrl);
    }

    public List<CertificateTemplate> listTemplates() {
        return certTemplateMapper.selectList(null);
    }

    public List<CertificateChangeLog> getChangeLogs(Long certId) {
        return changeLogMapper.selectList(new LambdaQueryWrapper<CertificateChangeLog>()
                .eq(CertificateChangeLog::getCertificateId, certId)
                .orderByDesc(CertificateChangeLog::getCreateTime));
    }
}
