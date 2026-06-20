package com.tvstation.media.scheduled;

import com.tvstation.media.dto.NotificationMessage;
import com.tvstation.media.entity.Copyright;
import com.tvstation.media.repository.CopyrightRepository;
import com.tvstation.media.service.CopyrightRiskAssessmentService;
import com.tvstation.media.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class CopyrightScheduledTask {

    private final CopyrightRepository copyrightRepository;
    private final CopyrightRiskAssessmentService riskAssessmentService;
    private final NotificationService notificationService;

    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void checkExpiringCopyrights() {
        LocalDate today = LocalDate.now();
        LocalDate expiryThreshold = today.plusDays(7);

        List<Copyright> expiring = copyrightRepository.findByExpiryDateRange(today, expiryThreshold);
        int notifiedCount = 0;

        for (Copyright copyright : expiring) {
            if (copyright.getStatus() == Copyright.CopyrightStatus.expired) {
                continue;
            }

            long daysRemaining = ChronoUnit.DAYS.between(today, copyright.getEndDate());

            copyright.setStatus(Copyright.CopyrightStatus.expiring);
            copyrightRepository.save(copyright);

            String title = String.format("【版权到期预警】%s 将于 %d 天后到期", copyright.getName(), daysRemaining);
            String content = String.format(
                    "版权到期预警通知\n\n" +
                    "版权名称：%s\n" +
                    "版权方：%s\n" +
                    "授权范围：%s\n" +
                    "到期日期：%s\n" +
                    "剩余天数：%d 天\n\n" +
                    "请及时办理续期手续，避免版权过期导致侵权风险。",
                    copyright.getName(),
                    copyright.getOwner(),
                    copyright.getAuthorizationScope() != null ? copyright.getAuthorizationScope() : "未指定",
                    copyright.getEndDate(),
                    daysRemaining);

            NotificationMessage message = NotificationMessage.builder()
                    .title(title)
                    .content(content)
                    .type(NotificationMessage.NotificationType.COPYRIGHT_EXPIRING)
                    .channel(NotificationMessage.Channel.ALL.name())
                    .extra(new HashMap<>())
                    .build();
            message.getExtra().put("copyrightId", copyright.getId());
            message.getExtra().put("daysRemaining", daysRemaining);

            notificationService.broadcastNotification(title, content);
            notifiedCount++;
            log.info("Copyright expiry notification sent: id={}, name={}, daysRemaining={}",
                    copyright.getId(), copyright.getName(), daysRemaining);
        }

        if (notifiedCount > 0) {
            log.info("Total copyright expiry notifications sent: {}", notifiedCount);
        }
    }

    @Scheduled(cron = "0 30 9 * * ?")
    @Transactional
    public void checkExpiredCopyrights() {
        LocalDate today = LocalDate.now();
        List<Copyright> expiredNotMarked = copyrightRepository.findExpiredButNotMarked(today);

        int updatedCount = 0;
        for (Copyright copyright : expiredNotMarked) {
            copyright.setStatus(Copyright.CopyrightStatus.expired);
            copyrightRepository.save(copyright);
            updatedCount++;

            String title = String.format("【版权已过期】%s 授权已到期", copyright.getName());
            String content = String.format(
                    "版权过期通知\n\n" +
                    "版权名称：%s\n" +
                    "版权方：%s\n" +
                    "到期日期：%s\n\n" +
                    "该版权已过期，关联素材请立即停止使用，避免侵权风险。",
                    copyright.getName(),
                    copyright.getOwner(),
                    copyright.getEndDate());

            notificationService.broadcastNotification(title, content);
            log.warn("Copyright expired: id={}, name={}", copyright.getId(), copyright.getName());
        }
        if (updatedCount > 0) {
            log.info("Updated {} copyrights to expired status", updatedCount);
        }
    }

    @Scheduled(cron = "0 0 10 * * ?")
    @Transactional
    public void assessAndNotifyCopyrightRisks() {
        riskAssessmentService.assessAllRisks();

        List<Copyright> unnotifiedRisks = copyrightRepository.findUnnotifiedHighRiskCopyrights();
        int notifiedCount = 0;

        for (Copyright copyright : unnotifiedRisks) {
            String title = String.format("【侵权风险提示】%s 存在高侵权风险", copyright.getName());
            String content = String.format(
                    "侵权风险预警通知\n\n" +
                    "版权名称：%s\n" +
                    "版权方：%s\n" +
                    "风险等级：%s\n" +
                    "风险评分：%d/100\n" +
                    "风险因素：%s\n\n" +
                    "请立即核实版权授权情况，采取风险防控措施。",
                    copyright.getName(),
                    copyright.getOwner(),
                    copyright.getRiskLevel(),
                    copyright.getRiskScore(),
                    copyright.getRiskFactors() != null ? copyright.getRiskFactors() : "未分析");

            notificationService.broadcastNotification(title, content);

            copyright.setRiskNotified(true);
            copyrightRepository.save(copyright);
            notifiedCount++;
            log.warn("Copyright risk notification sent: id={}, name={}, riskLevel={}, score={}",
                    copyright.getId(), copyright.getName(), copyright.getRiskLevel(), copyright.getRiskScore());
        }

        if (notifiedCount > 0) {
            log.info("Total copyright risk notifications sent: {}", notifiedCount);
        }
    }
}
