package com.heritage.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Slf4j
@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:heritage@example.com}")
    private String fromEmail;

    @Value("${heritage.mail.enabled:false}")
    private boolean mailEnabled;

    @Async
    public void sendSimpleEmail(String to, String subject, String text) {
        if (!mailEnabled) {
            log.info("邮件发送已禁用，跳过发送: to={}, subject={}", to, subject);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
            log.info("简单邮件发送成功: to={}, subject={}", to, subject);
        } catch (Exception e) {
            log.error("简单邮件发送失败: to={}, subject={}, error={}", to, subject, e.getMessage());
        }
    }

    @Async
    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        if (!mailEnabled) {
            log.info("邮件发送已禁用，跳过发送: to={}, subject={}", to, subject);
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            mailSender.send(mimeMessage);
            log.info("HTML邮件发送成功: to={}, subject={}", to, subject);
        } catch (MessagingException e) {
            log.error("HTML邮件发送失败: to={}, subject={}, error={}", to, subject, e.getMessage());
        }
    }

    public String buildBookingNotificationHtml(String title, String content, String bookingId, String status) {
        String statusColor = switch (status) {
            case "APPROVED" -> "#27ae60";
            case "REJECTED" -> "#e74c3c";
            case "PENDING" -> "#f39c12";
            case "CANCELLED" -> "#95a5a6";
            default -> "#3498db";
        };

        String statusText = switch (status) {
            case "APPROVED" -> "已批准";
            case "REJECTED" -> "已拒绝";
            case "PENDING" -> "待审批";
            case "CANCELLED" -> "已取消";
            case "COMPLETED" -> "已完成";
            default -> status;
        };

        return """
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#1a1a2e;font-family:'Microsoft YaHei',sans-serif;">
              <div style="max-width:600px;margin:20px auto;background:#16213e;border-radius:12px;overflow:hidden;border:1px solid rgba(200,169,110,0.2);">
                <div style="background:linear-gradient(135deg,#0f3460,#1a1a2e);padding:24px;text-align:center;">
                  <h1 style="color:#c8a96e;margin:0;font-size:22px;">非遗数字化保护平台</h1>
                </div>
                <div style="padding:24px;">
                  <h2 style="color:#e8e8e8;margin:0 0 16px;">%s</h2>
                  <p style="color:#c8c8c8;line-height:1.8;font-size:14px;">%s</p>
                  <div style="margin:20px 0;text-align:center;">
                    <span style="display:inline-block;padding:8px 24px;background:%s;color:#fff;border-radius:20px;font-weight:600;">%s</span>
                  </div>
                  <p style="color:#a0a0a0;font-size:12px;margin-top:24px;border-top:1px solid #2d3a4f;padding-top:16px;">
                    此邮件由系统自动发送，请勿直接回复。如有疑问请联系非遗数字化保护中心。
                  </p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(title, content, statusColor, statusText);
    }
}
