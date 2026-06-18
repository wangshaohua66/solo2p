package com.iccert.report.service;

import com.iccert.report.entity.CertificateInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * 证书到期真实通知发送服务。
 * 邮件：通过 Spring Boot Mail（JavaMailSender）真实投递。
 * 短信：通过可配置的 HTTP 网关（如阿里云短信）真实投递。
 * 当 SMTP/短信网关未配置时优雅降级为日志，不影响主流程。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationSenderService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    @Value("${spring.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${notification.sms.enabled:false}")
    private boolean smsEnabled;

    @Value("${notification.sms.gateway-url:}")
    private String smsGatewayUrl;

    @Value("${notification.sms.api-key:}")
    private String smsApiKey;

    @Value("${notification.sms.sign-name:检验检测认证中心}")
    private String smsSignName;

    @Value("${notification.sms.template-code:SMS_CERT_EXPIRE_REMIND}")
    private String smsTemplateCode;

    @Value("${notification.default-contacts.email:}")
    private String defaultContactEmail;

    @Value("${notification.default-contacts.phone:}")
    private String defaultContactPhone;

    /**
     * 异步发送证书到期提醒（邮件 + 短信）。
     */
    @Async
    public void sendCertificateExpireReminder(CertificateInfo cert, long daysLeft) {
        String subject = String.format("【证书到期提醒】您的%s认证证书将于%d天后到期", cert.getCertTypeCode(), daysLeft);
        String content = buildExpireContent(cert, daysLeft);

        String email = resolveContactEmail(cert);
        if (email != null) {
            sendEmail(email, subject, content);
        } else {
            log.warn("[证书提醒] 证书{}({})未配置企业联系邮箱, 跳过邮件发送",
                    cert.getCertNo(), cert.getCompanyName());
        }

        String phone = resolveContactPhone(cert);
        if (phone != null) {
            sendSms(phone, cert, daysLeft);
        } else {
            log.warn("[证书提醒] 证书{}({})未配置企业联系电话, 跳过短信发送",
                    cert.getCertNo(), cert.getCompanyName());
        }
    }

    private String buildExpireContent(CertificateInfo cert, long daysLeft) {
        String expireStr = cert.getExpireDate() != null
                ? cert.getExpireDate().format(DateTimeFormatter.ofPattern("yyyy年MM月dd日"))
                : "未知";
        return String.format(
                "尊敬的 %s ：\n\n" +
                        "您单位持有的 %s 认证证书即将到期，详情如下：\n" +
                        "  证书编号：%s\n" +
                        "  产品名称：%s\n" +
                        "  认证类型：%s\n" +
                        "  到期日期：%s\n" +
                        "  剩余天数：%d 天\n\n" +
                        "请及时登录检验检测认证中心平台办理续证手续，逾期将影响证书有效性。\n\n" +
                        "如有疑问，请联系检测认证中心客服。\n" +
                        "—— 检验检测认证中心",
                cert.getCompanyName() != null ? cert.getCompanyName() : "客户",
                cert.getCertTypeCode() != null ? cert.getCertTypeCode() : "",
                cert.getCertNo(),
                cert.getProductName() != null ? cert.getProductName() : "-",
                cert.getCertTypeCode() != null ? cert.getCertTypeCode() : "-",
                expireStr,
                daysLeft
        );
    }

    /**
     * 通过 JavaMailSender 真实投递邮件。
     */
    private void sendEmail(String to, String subject, String content) {
        if (!mailEnabled || mailFrom == null || mailFrom.isBlank()) {
            log.info("[邮件通知-未启用SMTP] 收件人:{} 主题:{} (内容已记录, 未实际投递)", to, subject);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(content);
            mailSender.send(message);
            log.info("[邮件通知] 证书到期提醒已发送至 {}", to);
        } catch (Exception e) {
            log.error("[邮件通知] 发送失败 收件人:{} 主题:{} 原因:{}", to, subject, e.getMessage());
        }
    }

    /**
     * 通过 HTTP 网关真实投递短信。
     * 采用 form-post 方式对接阿里云/腾讯云等通用短信网关。
     */
    private void sendSms(String phone, CertificateInfo cert, long daysLeft) {
        if (!smsEnabled || smsGatewayUrl == null || smsGatewayUrl.isBlank()) {
            log.info("[短信通知-未启用网关] 手机号:{} 证书{}({})剩余{}天 (内容已记录, 未实际投递)",
                    phone, cert.getCertNo(), cert.getCertTypeCode(), daysLeft);
            return;
        }
        HttpURLConnection conn = null;
        try {
            String params = "phone=" + URLEncoder.encode(phone, StandardCharsets.UTF_8) +
                    "&signName=" + URLEncoder.encode(smsSignName, StandardCharsets.UTF_8) +
                    "&templateCode=" + URLEncoder.encode(smsTemplateCode, StandardCharsets.UTF_8) +
                    "&apiKey=" + URLEncoder.encode(smsApiKey, StandardCharsets.UTF_8) +
                    "&certNo=" + URLEncoder.encode(cert.getCertNo() != null ? cert.getCertNo() : "", StandardCharsets.UTF_8) +
                    "&companyName=" + URLEncoder.encode(cert.getCompanyName() != null ? cert.getCompanyName() : "", StandardCharsets.UTF_8) +
                    "&daysLeft=" + daysLeft +
                    "&expireDate=" + (cert.getExpireDate() != null ? cert.getExpireDate().toString() : "");

            URL url = new URL(smsGatewayUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(params.getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            if (code == 200) {
                log.info("[短信通知] 证书到期提醒短信已发送至 {} (证书{} 剩余{}天)", phone, cert.getCertNo(), daysLeft);
            } else {
                log.warn("[短信通知] 短信网关返回非200: {} 手机号:{} 证书{}", code, phone, cert.getCertNo());
            }
        } catch (IOException e) {
            log.error("[短信通知] 发送失败 手机号:{} 证书{} 原因:{}", phone, cert.getCertNo(), e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * 解析企业联系邮箱：
     * 1. 优先从证书关联的 companyId 查询企业库（预留接口，未来可通过 OpenFeign 调用 icc-customer）；
     * 2. 若未查到或未配置企业库，回退到 application.yml 的 notification.default-contacts.email；
     * 3. 若默认也未配置，返回 null 触发日志降级，不抛出异常。
     */
    private String resolveContactEmail(CertificateInfo cert) {
        if (cert == null) {
            return safeContact(defaultContactEmail);
        }
        // TODO: 当 icc-customer 模块提供企业联系人查询接口后，通过 companyId 查询真实邮箱
        // if (cert.getCompanyId() != null) {
        //     try { String email = customerClient.getContactEmail(cert.getCompanyId());
        //       if (email != null && !email.isBlank()) return email; } catch (Exception ignore) {}
        // }
        String fallback = safeContact(defaultContactEmail);
        if (fallback != null) {
            log.info("[证书提醒] 证书{}({}) 使用默认联系邮箱: {}", cert.getCertNo(), cert.getCompanyName(), fallback);
        }
        return fallback;
    }

    /**
     * 解析企业联系电话：策略与邮箱一致。
     */
    private String resolveContactPhone(CertificateInfo cert) {
        if (cert == null) {
            return safeContact(defaultContactPhone);
        }
        // TODO: 同邮箱，未来可通过 companyId 查询企业真实联系电话
        String fallback = safeContact(defaultContactPhone);
        if (fallback != null) {
            log.info("[证书提醒] 证书{}({}) 使用默认联系电话: {}", cert.getCertNo(), cert.getCompanyName(), fallback);
        }
        return fallback;
    }

    private String safeContact(String s) {
        return (s != null && !s.isBlank()) ? s.trim() : null;
    }
}
