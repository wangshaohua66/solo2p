package com.crew.engine;

import com.crew.entity.CrewMember;
import com.crew.entity.DutyRecord;
import com.crew.entity.FatigueAlert;
import com.crew.entity.Roster;
import com.crew.mapper.CrewMemberMapper;
import com.crew.mapper.DutyRecordMapper;
import com.crew.mapper.FatigueAlertMapper;
import com.crew.mapper.RosterMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class FatigueDetector {

    private final DutyRecordMapper dutyRecordMapper;
    private final RosterMapper rosterMapper;
    private final CrewMemberMapper crewMemberMapper;
    private final FatigueAlertMapper fatigueAlertMapper;

    @Value("${crew.scheduling.duty.max-continuous-hours:14}")
    private double maxContinuousHours;

    @Value("${crew.scheduling.duty.max-weekly-hours:60}")
    private double maxWeeklyHours;

    @Value("${crew.scheduling.duty.max-monthly-hours:100}")
    private double maxMonthlyHours;

    @Value("${crew.scheduling.duty.timezone-recovery-hours:0.5}")
    private double timezoneRecoveryHours;

    @Value("${crew.scheduling.fatigue.yellow-threshold:0.8}")
    private double yellowThreshold;

    @Value("${crew.scheduling.fatigue.red-threshold:1.0}")
    private double redThreshold;

    @Value("${crew.scheduling.fatigue.risk-score-threshold:70}")
    private double riskScoreThreshold;

    public double calculateFatigueScore(Long crewId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        Double weeklyHours = dutyRecordMapper.sumActualHoursByCrewAndTimeRange(
                crewId, today.minusDays(6).atStartOfDay(), now);

        Double monthlyHours = dutyRecordMapper.sumActualHoursByCrewAndTimeRange(
                crewId, today.withDayOfMonth(1).atStartOfDay(), now);

        double weekly = weeklyHours != null ? weeklyHours : 0;
        double monthly = monthlyHours != null ? monthlyHours : 0;

        double weeklyRatio = weekly / maxWeeklyHours;
        double monthlyRatio = monthly / maxMonthlyHours;

        double score = 0;
        score += Math.min(weeklyRatio * 30, 30);
        score += Math.min(monthlyRatio * 25, 25);

        List<DutyRecord> recentDuties = dutyRecordMapper.findByCrewAndTimeRange(
                crewId, today.minusDays(7).atStartOfDay(), now);
        int consecutiveDays = calculateConsecutiveDays(recentDuties, today);
        score += Math.min(consecutiveDays * 6, 25);

        int timezoneCrossings = recentDuties.stream()
                .mapToInt(r -> r.getTimezoneCrossings() != null ? r.getTimezoneCrossings() : 0)
                .sum();
        score += Math.min(Math.abs(timezoneCrossings) * 2, 10);

        long redEyeCount = recentDuties.stream()
                .filter(r -> {
                    if (r.getCheckInTime() == null) return false;
                    int hour = r.getCheckInTime().getHour();
                    return hour >= 22 || hour < 5;
                })
                .count();
        score += Math.min(redEyeCount * 5, 10);

        return Math.min(score, 100);
    }

    public String determineAlertLevel(double dutyRatio) {
        if (dutyRatio >= redThreshold) {
            return "RED";
        } else if (dutyRatio >= yellowThreshold) {
            return "YELLOW";
        }
        return "GREEN";
    }

    public String evaluateDutyStatus(Long crewId, double currentDutyHours) {
        double ratio = currentDutyHours / maxContinuousHours;
        String level = determineAlertLevel(ratio);

        if ("RED".equals(level)) {
            triggerAlert(crewId, null, "RED", ratio, currentDutyHours);
            return "LOCKED";
        } else if ("YELLOW".equals(level)) {
            triggerAlert(crewId, null, "YELLOW", ratio, currentDutyHours);
            return "WARNING";
        }

        return "NORMAL";
    }

    public FatigueAlert triggerAlert(Long crewId, Long dutyRecordId, String level,
                                      double dutyRatio, double currentHours) {
        FatigueAlert alert = new FatigueAlert();
        alert.setCrewId(crewId);
        alert.setDutyRecordId(dutyRecordId);
        alert.setAlertLevel(level);
        alert.setDutyRatio(dutyRatio);
        alert.setStatus("ACTIVE");
        alert.setTriggeredAt(LocalDateTime.now());

        if ("RED".equals(level)) {
            double fatigueScore = calculateFatigueScore(crewId);
            alert.setFatigueScore(fatigueScore);
            alert.setMessage(String.format(
                    "执勤时长已达%.1f小时（上限%.0f小时），比例%.0f%%，已自动锁定排班",
                    currentHours, maxContinuousHours, dutyRatio * 100));

            CrewMember crew = crewMemberMapper.selectById(crewId);
            if (crew != null) {
                crew.setStatus("GROUNDED");
                crewMemberMapper.updateById(crew);
            }
        } else if ("YELLOW".equals(level)) {
            double fatigueScore = calculateFatigueScore(crewId);
            alert.setFatigueScore(fatigueScore);
            alert.setMessage(String.format(
                    "执勤时长已达%.1f小时（上限%.0f小时），比例%.0f%%，请注意休息",
                    currentHours, maxContinuousHours, dutyRatio * 100));
        }

        fatigueAlertMapper.insert(alert);
        log.warn("疲劳预警触发: crewId={}, level={}, ratio={}", crewId, level, dutyRatio);
        return alert;
    }

    public void checkAndAlertFatigueScore(Long crewId) {
        double fatigueScore = calculateFatigueScore(crewId);

        if (fatigueScore > riskScoreThreshold) {
            FatigueAlert alert = new FatigueAlert();
            alert.setCrewId(crewId);
            alert.setAlertLevel("FATIGUE_HIGH");
            alert.setFatigueScore(fatigueScore);
            alert.setStatus("ACTIVE");
            alert.setTriggeredAt(LocalDateTime.now());
            alert.setMessage(String.format(
                    "疲劳指数%.1f超过阈值%.0f，禁止安排后续航班", fatigueScore, riskScoreThreshold));
            fatigueAlertMapper.insert(alert);

            CrewMember crew = crewMemberMapper.selectById(crewId);
            if (crew != null && "AVAILABLE".equals(crew.getStatus())) {
                crew.setStatus("GROUNDED");
                crewMemberMapper.updateById(crew);
                log.warn("机组因疲劳指数超标被停飞: crewId={}, score={}", crewId, fatigueScore);
            }
        }
    }

    public double calculateTimezoneRecoveryHours(int timezoneCrossings) {
        return Math.abs(timezoneCrossings) * timezoneRecoveryHours;
    }

    private int calculateConsecutiveDays(List<DutyRecord> duties, LocalDate today) {
        if (duties.isEmpty()) return 0;

        int consecutive = 0;
        LocalDate checkDate = today;

        while (true) {
            boolean hasDutyOnDate = duties.stream()
                    .anyMatch(d -> d.getCheckInTime() != null &&
                            d.getCheckInTime().toLocalDate().equals(checkDate));
            if (hasDutyOnDate) {
                consecutive++;
                checkDate = checkDate.minusDays(1);
            } else {
                break;
            }
        }

        return consecutive;
    }
}
