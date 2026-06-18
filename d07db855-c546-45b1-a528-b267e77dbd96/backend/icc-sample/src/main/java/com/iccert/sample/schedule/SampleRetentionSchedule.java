package com.iccert.sample.schedule;

import com.iccert.sample.entity.SampleInfo;
import com.iccert.sample.mapper.SampleInfoMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SampleRetentionSchedule {

    private final SampleInfoMapper sampleInfoMapper;

    @Scheduled(cron = "0 0 9 * * ?")
    public void checkRetentionExpire() {
        LocalDate today = LocalDate.now();
        LocalDate warningDate = today.plusDays(15);
        List<SampleInfo> expiring = sampleInfoMapper.selectExpiringRetentionSamples(today, warningDate);
        if (!expiring.isEmpty()) {
            log.info("[留样到期提醒] 发现{}份样品留样即将到期, 需提醒管理员处理", expiring.size());
            for (SampleInfo s : expiring) {
                log.info("  样品: {}({}), 到期日: {}, 状态: {}",
                        s.getSampleName(), s.getSampleCode(), s.getRetentionExpireDate(), s.getSampleStatus());
                pushNotification(s);
            }
        }

        List<SampleInfo> expired = sampleInfoMapper.selectExpiredRetentionSamples(today);
        if (!expired.isEmpty()) {
            log.warn("[留样超期警告] 发现{}份样品留样已超期, 请尽快按流程销毁", expired.size());
            for (SampleInfo s : expired) {
                log.warn("  超期样品: {}({}), 到期日: {}",
                        s.getSampleName(), s.getSampleCode(), s.getRetentionExpireDate());
            }
        }
    }

    private void pushNotification(SampleInfo sample) {
        try {
            log.info("模拟推送通知: [留样到期提醒] 样品{}将在{}天后到期",
                    sample.getSampleCode(),
                    java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), sample.getRetentionExpireDate()));
        } catch (Exception e) {
            log.warn("留样到期通知推送失败", e);
        }
    }
}
