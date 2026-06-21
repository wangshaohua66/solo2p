package com.court.execution.config;

import com.court.execution.entity.SeizureRecord;
import com.court.execution.repository.SeizureRecordRepository;
import com.court.execution.service.CoordinationService;
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

    public SchedulerConfig(SeizureRecordRepository seizureRepository,
                           CoordinationService coordinationService) {
        this.seizureRepository = seizureRepository;
        this.coordinationService = coordinationService;
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void seizureExpirationWarning() {
        logger.info("开始执行查封到期预警定时任务...");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime warningDate = now.plusDays(7);

        List<SeizureRecord> seizures = seizureRepository.findSeizuresNeedingWarning(warningDate);

        for (SeizureRecord seizure : seizures) {
            seizure.setWarningSent(true);
            seizureRepository.save(seizure);
            logger.info("查封到期预警：财产ID={}, 到期时间={}, 案件ID={}",
                    seizure.getProperty().getId(),
                    seizure.getEndDate(),
                    seizure.getExecutionCase().getId());
        }

        logger.info("查封到期预警定时任务执行完成，共发送{}条预警", seizures.size());
    }

    @Scheduled(cron = "0 0 3 * * ?")
    public void checkExpiredSeizures() {
        logger.info("开始检查已过期的查封记录...");

        LocalDateTime now = LocalDateTime.now();
        List<SeizureRecord> expiredSeizures = seizureRepository.findSeizuresExpiringBetween(
                now.minusYears(100), now);

        for (SeizureRecord seizure : expiredSeizures) {
            if (!seizure.getExpired()) {
                seizure.setExpired(true);
                seizureRepository.save(seizure);
                logger.info("查封已过期：查封记录ID={}", seizure.getId());
            }
        }

        logger.info("已过期查封检查完成");
    }

    @Scheduled(cron = "0 0 9 * * ?")
    public void coordinationLetterReminder() {
        logger.info("开始执行协执函超时催办定时任务...");

        int count = coordinationService.sendReminders(72);

        logger.info("协执函超时催办定时任务执行完成，共发送{}条催办提醒", count);
    }
}
