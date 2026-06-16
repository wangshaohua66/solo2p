package com.crew.scheduler;

import com.crew.engine.FatigueDetector;
import com.crew.entity.CrewMember;
import com.crew.entity.DutyRecord;
import com.crew.entity.FatigueAlert;
import com.crew.entity.Qualification;
import com.crew.mapper.CrewMemberMapper;
import com.crew.mapper.DutyRecordMapper;
import com.crew.mapper.FatigueAlertMapper;
import com.crew.mapper.QualificationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DutyTracker {

    private final DutyRecordMapper dutyRecordMapper;
    private final FatigueAlertMapper fatigueAlertMapper;
    private final CrewMemberMapper crewMemberMapper;
    private final QualificationMapper qualificationMapper;
    private final FatigueDetector fatigueDetector;

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void syncActiveDutyStatus() {
        List<DutyRecord> activeDuties = dutyRecordMapper.findActiveDuties();

        for (DutyRecord record : activeDuties) {
            double currentHours = ChronoUnit.MINUTES.between(record.getCheckInTime(), LocalDateTime.now()) / 60.0;

            String status = fatigueDetector.evaluateDutyStatus(record.getCrewId(), currentHours);

            if ("LOCKED".equals(status)) {
                log.warn("执勤超时锁定: crewId={}, dutyHours={:.1f}", record.getCrewId(), currentHours);
            }
        }
    }

    @Scheduled(cron = "0 0 6 * * ?")
    @Transactional
    public void checkQualificationExpiry() {
        LocalDate today = LocalDate.now();

        List<Qualification> expiring30 = qualificationMapper.findExpiringBefore(today, today.plusDays(30));
        List<Qualification> expiring15 = qualificationMapper.findExpiringBefore(today, today.plusDays(15));
        List<Qualification> expiring7 = qualificationMapper.findExpiringBefore(today, today.plusDays(7));
        List<Qualification> expired = qualificationMapper.findExpired(today);

        for (Qualification qual : expiring30) {
            log.warn("资质30天内到期: crewId={}, type={}, expiryDate={}",
                    qual.getCrewId(), qual.getQualType(), qual.getExpiryDate());
        }

        for (Qualification qual : expiring15) {
            log.warn("资质15天内到期: crewId={}, type={}, expiryDate={}",
                    qual.getCrewId(), qual.getQualType(), qual.getExpiryDate());
        }

        for (Qualification qual : expiring7) {
            log.warn("资质7天内到期: crewId={}, type={}, expiryDate={}",
                    qual.getCrewId(), qual.getQualType(), qual.getExpiryDate());
        }

        for (Qualification qual : expired) {
            qual.setStatus("EXPIRED");
            qualificationMapper.updateById(qual);

            if ("TYPE_RATING".equals(qual.getQualType()) || "LICENSE".equals(qual.getQualType()) || "MEDICAL".equals(qual.getQualType())) {
                CrewMember crew = crewMemberMapper.selectById(qual.getCrewId());
                if (crew != null && "AVAILABLE".equals(crew.getStatus())) {
                    crew.setStatus("GROUNDED");
                    crewMemberMapper.updateById(crew);
                    log.warn("机组因资质过期被停飞: crewId={}", crew.getId());
                }
            }
        }

        log.info("资质到期检查完成: 30天内={}, 15天内={}, 7天内={}, 已过期={}",
                expiring30.size(), expiring15.size(), expiring7.size(), expired.size());
    }

    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional
    public void scanFatigueScores() {
        List<CrewMember> activeCrew = crewMemberMapper.selectList(
                new LambdaQueryWrapper<CrewMember>()
                        .in(CrewMember::getStatus, List.of("AVAILABLE", "ON_DUTY"))
        );

        int highFatigueCount = 0;
        for (CrewMember crew : activeCrew) {
            double score = fatigueDetector.calculateFatigueScore(crew.getId());
            if (score > 70) {
                highFatigueCount++;
                fatigueDetector.checkAndAlertFatigueScore(crew.getId());
            }
        }

        log.info("疲劳指数扫描完成: 检查人数={}, 高风险人数={}", activeCrew.size(), highFatigueCount);
    }

    @Scheduled(cron = "0 0 0 * * MON")
    @Transactional
    public void resetWeeklyCounters() {
        List<CrewMember> allCrew = crewMemberMapper.selectList(null);
        for (CrewMember crew : allCrew) {
            crew.setWeeklyFlightHours(0.0);
            crew.setConsecutiveDutyDays(0);
            crewMemberMapper.updateById(crew);
        }
        log.info("周计数器重置完成: 人数={}", allCrew.size());
    }

    @Scheduled(cron = "0 0 0 1 * ?")
    @Transactional
    public void resetMonthlyCounters() {
        List<CrewMember> allCrew = crewMemberMapper.selectList(null);
        for (CrewMember crew : allCrew) {
            crew.setMonthlyFlightHours(0.0);
            crewMemberMapper.updateById(crew);
        }
        log.info("月计数器重置完成: 人数={}", allCrew.size());
    }
}
