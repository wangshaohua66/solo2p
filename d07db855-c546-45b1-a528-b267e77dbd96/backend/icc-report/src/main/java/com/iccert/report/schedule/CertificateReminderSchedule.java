package com.iccert.report.schedule;

import com.iccert.report.entity.CertificateInfo;
import com.iccert.report.mapper.CertificateInfoMapper;
import com.iccert.report.service.NotificationSenderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 证书到期真实通知定时任务。
 * 扫描即将到期（默认60天内）且未提醒过的证书，通过邮件/短信真实投递续证提醒，
 * 并标记 is_reminder_sent = 1 避免重复提醒。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CertificateReminderSchedule {

    private final CertificateInfoMapper certificateMapper;
    private final NotificationSenderService notificationSender;

    @Value("${certificate.reminder.advance-days:60}")
    private int advanceDays;

    @Scheduled(cron = "0 30 8 * * ?")
    public void checkCertificateExpiry() {
        LocalDate today = LocalDate.now();
        LocalDate reminderDate = today.plusDays(advanceDays);
        List<CertificateInfo> expiring = certificateMapper.selectExpiringCertificates(today, reminderDate);
        if (expiring == null || expiring.isEmpty()) {
            log.debug("[证书到期提醒] 当前无即将到期证书需要提醒");
            return;
        }
        log.info("[证书到期提醒] 发现{}份证书将在{}天内到期, 开始通过邮件/短信发送续证提醒",
                expiring.size(), advanceDays);
        for (CertificateInfo c : expiring) {
            try {
                long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(today, c.getExpireDate());
                notificationSender.sendCertificateExpireReminder(c, daysLeft);
                c.setIsReminderSent(1);
                c.setReminderSentDate(today);
                if (daysLeft <= 0) c.setCertStatus("EXPIRED");
                else if (daysLeft <= 30) c.setCertStatus("EXPIRING");
                certificateMapper.updateById(c);
            } catch (Exception e) {
                log.error("[证书到期提醒] 证书{}提醒发送失败", c.getCertNo(), e);
            }
        }
        log.info("[证书到期提醒] 续证提醒处理完成, 共处理{}份证书", expiring.size());
    }
}
