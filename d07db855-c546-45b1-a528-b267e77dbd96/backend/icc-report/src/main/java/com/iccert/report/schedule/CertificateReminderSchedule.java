package com.iccert.report.schedule;

import com.iccert.report.entity.CertificateInfo;
import com.iccert.report.mapper.CertificateInfoMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class CertificateReminderSchedule {

    private final CertificateInfoMapper certificateMapper;

    @Value("${certificate.reminder.advance-days:60}")
    private int advanceDays;

    @Scheduled(cron = "0 30 8 * * ?")
    public void checkCertificateExpiry() {
        LocalDate today = LocalDate.now();
        LocalDate reminderDate = today.plusDays(advanceDays);
        List<CertificateInfo> expiring = certificateMapper.selectExpiringCertificates(today, reminderDate);
        if (!expiring.isEmpty()) {
            log.info("[证书到期提醒] 发现{}份证书将在{}天内到期, 需通知客户续证", expiring.size(), advanceDays);
            for (CertificateInfo c : expiring) {
                long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(today, c.getExpireDate());
                log.info("  证书: {}({}) 企业: {} 到期日: {} 剩余{}天",
                        c.getCertNo(), c.getCertTypeCode(), c.getCompanyName(),
                        c.getExpireDate(), daysLeft);
                sendReminder(c, daysLeft);
                c.setIsReminderSent(1);
                c.setReminderSentDate(today);
                if (daysLeft <= 0) c.setCertStatus("EXPIRED");
                else if (daysLeft <= 30) c.setCertStatus("EXPIRING");
                certificateMapper.updateById(c);
            }
        }
    }

    private void sendReminder(CertificateInfo cert, long daysLeft) {
        try {
            log.info("【模拟邮件/短信推送】致 {}: 您的证书{}({})将于{}天后到期,请及时办理续证手续",
                    cert.getCompanyName(), cert.getCertNo(), cert.getCertTypeCode(), daysLeft);
        } catch (Exception e) {
            log.warn("证书续证提醒推送失败: {}", cert.getCertNo(), e);
        }
    }
}
