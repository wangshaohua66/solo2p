package com.court.execution.config;

import com.court.execution.entity.SeizureRecord;
import com.court.execution.entity.User;
import com.court.execution.repository.SeizureRecordRepository;
import com.court.execution.service.CoordinationService;
import com.court.execution.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.LocalDateTime;
import java.util.List;

@Configuration
@EnableScheduling
public class SchedulerConfig {

    private static final Logger logger = LoggerFactory.getLogger(SchedulerConfig.class);

    private final SeizureRecordRepository seizureRepository;
    private final CoordinationService coordinationService;
    private final NotificationService notificationService;

    public SchedulerConfig(SeizureRecordRepository seizureRepository,
                           CoordinationService coordinationService,
                           NotificationService notificationService) {
        this.seizureRepository = seizureRepository;
        this.coordinationService = coordinationService;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void seizureExpirationWarning() {
        logger.info("开始执行查封到期预警定时任务...");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime warningDate = now.plusDays(7);

        List<SeizureRecord> seizures = seizureRepository.findSeizuresNeedingWarning(warningDate);

        int sentCount = 0;
        for (SeizureRecord seizure : seizures) {
            if (Boolean.TRUE.equals(seizure.getWarningSent())) {
                continue;
            }

            User judge = seizure.getExecutionCase().getJudge();
            if (judge == null) {
                logger.warn("查封记录ID={} 对应的案件没有分配法官，跳过预警推送", seizure.getId());
                seizure.setWarningSent(true);
                seizureRepository.save(seizure);
                continue;
            }

            try {
                notificationService.sendSeizureWarning(
                        judge,
                        seizure.getId(),
                        seizure.getProperty().getId(),
                        seizure.getProperty().getPropertyName(),
                        seizure.getEndDate()
                );

                seizure.setWarningSent(true);
                seizureRepository.save(seizure);
                sentCount++;

                logger.info("查封到期预警已推送：法官={}, 财产={}, 到期时间={}",
                        judge.getRealName(),
                        seizure.getProperty().getPropertyName(),
                        seizure.getEndDate());
            } catch (Exception e) {
                logger.error("推送查封到期预警失败，查封ID={}", seizure.getId(), e);
            }
        }

        logger.info("查封到期预警定时任务执行完成，共推送{}条预警（筛选出{}条待预警）", sentCount, seizures.size());
    }

    @Scheduled(cron = "0 0 3 * * ?")
    public void checkExpiredSeizures() {
        logger.info("开始检查已过期的查封记录...");

        LocalDateTime now = LocalDateTime.now();
        List<SeizureRecord> expiredSeizures = seizureRepository.findSeizuresExpiringBetween(
                now.minusYears(100), now);

        int count = 0;
        for (SeizureRecord seizure : expiredSeizures) {
            if (!Boolean.TRUE.equals(seizure.getExpired())) {
                seizure.setExpired(true);
                seizureRepository.save(seizure);
                count++;
                logger.info("查封已过期：查封记录ID={}", seizure.getId());
            }
        }

        logger.info("已过期查封检查完成，共标记{}条已过期", count);
    }

    @Scheduled(cron = "0 0 9 * * ?")
    public void coordinationLetterReminder() {
        logger.info("开始执行协执函超时催办定时任务...");

        int count = coordinationService.triggerTimeoutReminders(72);

        logger.info("协执函超时催办定时任务执行完成，共触发{}条催办提醒", count);
    }
}
