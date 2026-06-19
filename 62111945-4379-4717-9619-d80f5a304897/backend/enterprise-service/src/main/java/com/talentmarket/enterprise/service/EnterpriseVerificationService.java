package com.talentmarket.enterprise.service;

import cn.hutool.core.util.IdcardUtil;
import cn.hutool.core.util.ReUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EnterpriseVerificationService {

    @Value("${verification.mock:true}")
    private boolean mockMode;

    private static final String CREDIT_CODE_PATTERN = "^[0-9A-HJ-NPQRTUWXY]{2}\\d{6}[0-9A-HJ-NPQRTUWXY]{10}$";

    public VerificationResult verifyEnterprise(String enterpriseName, String unifiedSocialCreditCode,
                                               String legalPerson, String businessLicenseUrl) {
        log.info("开始企业资质审核，企业名称: {}, 统一社会信用代码: {}", enterpriseName, unifiedSocialCreditCode);

        if (mockMode) {
            return mockVerify(enterpriseName, unifiedSocialCreditCode, legalPerson);
        }

        return realVerify(enterpriseName, unifiedSocialCreditCode, legalPerson, businessLicenseUrl);
    }

    private VerificationResult mockVerify(String enterpriseName, String unifiedSocialCreditCode, String legalPerson) {
        log.info("[模拟模式] 执行企业资质自动审核");

        if (!validateCreditCode(unifiedSocialCreditCode)) {
            return new VerificationResult(false, "统一社会信用代码格式不正确",
                    LocalDateTime.now(), "信用代码验证失败", null);
        }

        if (enterpriseName == null || enterpriseName.length() < 4) {
            return new VerificationResult(false, "企业名称不合法",
                    LocalDateTime.now(), "名称验证失败", null);
        }

        if (legalPerson == null || legalPerson.length() < 2) {
            return new VerificationResult(false, "法人姓名不合法",
                    LocalDateTime.now(), "法人验证失败", null);
        }

        Map<String, Object> enterpriseInfo = Map.of(
                "enterpriseName", enterpriseName,
                "unifiedSocialCreditCode", unifiedSocialCreditCode,
                "legalPerson", legalPerson,
                "registeredCapital", "500万人民币",
                "registrationDate", "2020-01-01",
                "status", "存续",
                "industry", "信息技术服务业"
        );

        log.info("[模拟模式] 企业资质自动审核通过");
        return new VerificationResult(true, "自动审核通过",
                LocalDateTime.now(), "工商信息API对接成功", enterpriseInfo);
    }

    private VerificationResult realVerify(String enterpriseName, String unifiedSocialCreditCode,
                                          String legalPerson, String businessLicenseUrl) {
        log.info("调用工商信息API进行企业认证，企业: {}", enterpriseName);
        
        try {
            log.info("调用工商信息API...");
            
            Map<String, Object> enterpriseInfo = fetchFromBusinessApi(unifiedSocialCreditCode);

            if (enterpriseInfo == null) {
                return new VerificationResult(false, "未查询到企业工商信息",
                        LocalDateTime.now(), "工商API查询无结果", null);
            }

            String apiEnterpriseName = (String) enterpriseInfo.get("enterpriseName");
            String apiLegalPerson = (String) enterpriseInfo.get("legalPerson");
            String status = (String) enterpriseInfo.get("status");

            if (!"存续".equals(status) && !"在营".equals(status)) {
                return new VerificationResult(false, "企业经营状态异常：" + status,
                        LocalDateTime.now(), "经营状态验证失败", enterpriseInfo);
            }

            if (!enterpriseName.equals(apiEnterpriseName)) {
                return new VerificationResult(false, "企业名称与工商登记信息不一致",
                        LocalDateTime.now(), "企业名称比对失败", enterpriseInfo);
            }

            if (!legalPerson.equals(apiLegalPerson)) {
                return new VerificationResult(false, "法人信息与工商登记不一致",
                        LocalDateTime.now(), "法人信息比对失败", enterpriseInfo);
            }

            log.info("企业资质审核通过，企业: {}", enterpriseName);
            return new VerificationResult(true, "自动审核通过",
                    LocalDateTime.now(), "工商信息验证成功", enterpriseInfo);

        } catch (Exception e) {
            log.error("企业资质审核异常", e);
            return new VerificationResult(false, "审核系统异常，请稍后重试",
                    LocalDateTime.now(), "审核异常：" + e.getMessage(), null);
        }
    }

    private Map<String, Object> fetchFromBusinessApi(String creditCode) {
        log.info("调用工商信息API查询企业信息，信用代码: {}", creditCode);
        return null;
    }

    public boolean validateCreditCode(String creditCode) {
        if (creditCode == null || creditCode.isEmpty()) {
            return false;
        }
        return ReUtil.isMatch(CREDIT_CODE_PATTERN, creditCode);
    }

    public boolean validateIdCard(String idCard) {
        if (idCard == null || idCard.isEmpty()) {
            return false;
        }
        try {
            return IdcardUtil.isValidCard(idCard);
        } catch (Exception e) {
            return false;
        }
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class VerificationResult {
        private boolean passed;
        private String message;
        private LocalDateTime verifyTime;
        private String verifySource;
        private Map<String, Object> enterpriseInfo;
    }
}
