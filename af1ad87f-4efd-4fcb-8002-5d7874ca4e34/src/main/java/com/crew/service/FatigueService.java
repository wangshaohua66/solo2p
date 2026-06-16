package com.crew.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crew.common.BusinessException;
import com.crew.common.ErrorCode;
import com.crew.common.PageResult;
import com.crew.dto.DutyCheckRequest;
import com.crew.dto.FatigueReportVO;
import com.crew.engine.FatigueDetector;
import com.crew.entity.CrewMember;
import com.crew.entity.DutyRecord;
import com.crew.entity.FatigueAlert;
import com.crew.mapper.CrewMemberMapper;
import com.crew.mapper.DutyRecordMapper;
import com.crew.mapper.FatigueAlertMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FatigueService {

    private final DutyRecordMapper dutyRecordMapper;
    private final FatigueAlertMapper fatigueAlertMapper;
    private final CrewMemberMapper crewMemberMapper;
    private final FatigueDetector fatigueDetector;

    @Transactional
    public DutyRecord checkIn(DutyCheckRequest request) {
        CrewMember crew = crewMemberMapper.selectById(request.getCrewId());
        if (crew == null) {
            throw new BusinessException(ErrorCode.CREW_NOT_FOUND);
        }

        long activeCount = dutyRecordMapper.selectCount(
                new LambdaQueryWrapper<DutyRecord>()
                        .eq(DutyRecord::getCrewId, request.getCrewId())
                        .eq(DutyRecord::getStatus, "ACTIVE")
        );
        if (activeCount > 0) {
            throw new BusinessException(ErrorCode.FATIGUE_DUTY_LOCKED.getCode(), "存在未签退的执勤记录");
        }

        DutyRecord record = new DutyRecord();
        record.setCrewId(request.getCrewId());
        record.setRosterId(request.getRosterId());
        record.setCheckInTime(LocalDateTime.now());
        record.setStatus("ACTIVE");
        record.setOvertimeFlag(false);
        dutyRecordMapper.insert(record);

        crew.setStatus("ON_DUTY");
        crewMemberMapper.updateById(crew);

        log.info("执勤签到: crewId={}, rosterId={}", request.getCrewId(), request.getRosterId());
        return record;
    }

    @Transactional
    public DutyRecord checkOut(DutyCheckRequest request) {
        DutyRecord record = dutyRecordMapper.selectOne(
                new LambdaQueryWrapper<DutyRecord>()
                        .eq(DutyRecord::getCrewId, request.getCrewId())
                        .eq(DutyRecord::getStatus, "ACTIVE")
                        .orderByDesc(DutyRecord::getCheckInTime)
                        .last("LIMIT 1")
        );

        if (record == null) {
            throw new BusinessException(ErrorCode.FATIGUE_NOT_FOUND.getCode(), "无活跃执勤记录");
        }

        LocalDateTime now = LocalDateTime.now();
        record.setCheckOutTime(now);
        double dutyHours = ChronoUnit.MINUTES.between(record.getCheckInTime(), now) / 60.0;
        record.setActualDutyHours(dutyHours);
        record.setStatus("COMPLETED");

        double fatigueScore = fatigueDetector.calculateFatigueScore(request.getCrewId());
        record.setFatigueScore(fatigueScore);

        if (dutyHours > 14) {
            record.setOvertimeFlag(true);
        }

        dutyRecordMapper.updateById(record);

        String dutyStatus = fatigueDetector.evaluateDutyStatus(request.getCrewId(), dutyHours);
        log.info("执勤签退: crewId={}, dutyHours={:.1f}, fatigueScore={:.1f}, status={}",
                request.getCrewId(), dutyHours, fatigueScore, dutyStatus);

        CrewMember crew = crewMemberMapper.selectById(request.getCrewId());
        if (crew != null) {
            if ("LOCKED".equals(dutyStatus)) {
                crew.setStatus("GROUNDED");
            } else {
                crew.setStatus("AVAILABLE");
                crew.setLastDutyEnd(now);
                crew.setMonthlyFlightHours(
                        (crew.getMonthlyFlightHours() != null ? crew.getMonthlyFlightHours() : 0) + dutyHours);
                crew.setWeeklyFlightHours(
                        (crew.getWeeklyFlightHours() != null ? crew.getWeeklyFlightHours() : 0) + dutyHours);
            }
            crewMemberMapper.updateById(crew);
        }

        fatigueDetector.checkAndAlertFatigueScore(request.getCrewId());

        return record;
    }

    public FatigueReportVO getFatigueReport(Long crewId) {
        CrewMember crew = crewMemberMapper.selectById(crewId);
        if (crew == null) {
            throw new BusinessException(ErrorCode.CREW_NOT_FOUND);
        }

        double fatigueScore = fatigueDetector.calculateFatigueScore(crewId);

        LocalDate today = LocalDate.now();
        Double weeklyHours = dutyRecordMapper.sumActualHoursByCrewAndTimeRange(
                crewId, today.minusDays(6).atStartOfDay(), LocalDateTime.now());
        Double monthlyHours = dutyRecordMapper.sumActualHoursByCrewAndTimeRange(
                crewId, today.withDayOfMonth(1).atStartOfDay(), LocalDateTime.now());

        List<DutyRecord> recentDuties = dutyRecordMapper.findByCrewAndTimeRange(
                crewId, today.minusDays(7).atStartOfDay(), LocalDateTime.now());
        int consecutiveDays = 0;
        for (int i = 0; i < 7; i++) {
            LocalDate checkDate = today.minusDays(i);
            boolean hasDuty = recentDuties.stream()
                    .anyMatch(d -> d.getCheckInTime() != null &&
                            d.getCheckInTime().toLocalDate().equals(checkDate));
            if (hasDuty) consecutiveDays++;
            else break;
        }

        int tzCrossings = recentDuties.stream()
                .mapToInt(d -> d.getTimezoneCrossings() != null ? d.getTimezoneCrossings() : 0)
                .sum();

        String alertLevel;
        if (fatigueScore >= 70) {
            alertLevel = "RED";
        } else if (fatigueScore >= 50) {
            alertLevel = "YELLOW";
        } else {
            alertLevel = "GREEN";
        }

        boolean isLocked = "GROUNDED".equals(crew.getStatus());

        FatigueReportVO report = new FatigueReportVO();
        report.setCrewId(crewId);
        report.setCrewName(crew.getName());
        report.setCurrentFatigueScore(fatigueScore);
        report.setWeeklyDutyHours(weeklyHours != null ? weeklyHours : 0);
        report.setMonthlyDutyHours(monthlyHours != null ? monthlyHours : 0);
        report.setConsecutiveDutyDays(consecutiveDays);
        report.setTimezoneCrossings(tzCrossings);
        report.setAlertLevel(alertLevel);
        report.setIsLocked(isLocked);

        return report;
    }

    public PageResult<FatigueAlert> listAlerts(Long crewId, String alertLevel, String status,
                                                int page, int size) {
        LambdaQueryWrapper<FatigueAlert> wrapper = new LambdaQueryWrapper<>();
        if (crewId != null) wrapper.eq(FatigueAlert::getCrewId, crewId);
        if (alertLevel != null) wrapper.eq(FatigueAlert::getAlertLevel, alertLevel);
        if (status != null) wrapper.eq(FatigueAlert::getStatus, status);
        wrapper.orderByDesc(FatigueAlert::getTriggeredAt);

        IPage<FatigueAlert> result = fatigueAlertMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    public PageResult<DutyRecord> listDutyRecords(Long crewId, LocalDate startDate, LocalDate endDate,
                                                    int page, int size) {
        LambdaQueryWrapper<DutyRecord> wrapper = new LambdaQueryWrapper<>();
        if (crewId != null) wrapper.eq(DutyRecord::getCrewId, crewId);
        if (startDate != null) wrapper.ge(DutyRecord::getCheckInTime, startDate.atStartOfDay());
        if (endDate != null) wrapper.le(DutyRecord::getCheckInTime, endDate.atTime(23, 59, 59));
        wrapper.orderByDesc(DutyRecord::getCheckInTime);

        IPage<DutyRecord> result = dutyRecordMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    @Transactional
    public void resolveAlert(Long alertId) {
        FatigueAlert alert = fatigueAlertMapper.selectById(alertId);
        if (alert == null) {
            throw new BusinessException(ErrorCode.FATIGUE_NOT_FOUND);
        }
        alert.setStatus("RESOLVED");
        alert.setResolvedAt(LocalDateTime.now());
        fatigueAlertMapper.updateById(alert);
    }
}
