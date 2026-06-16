package com.crew.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.crew.dto.StatisticsRequest;
import com.crew.dto.StatisticsVO;
import com.crew.entity.*;
import com.crew.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final CrewMemberMapper crewMemberMapper;
    private final RosterMapper rosterMapper;
    private final RosterPlanMapper rosterPlanMapper;
    private final DutyRecordMapper dutyRecordMapper;
    private final FatigueAlertMapper fatigueAlertMapper;
    private final ConflictRecordMapper conflictRecordMapper;

    public StatisticsVO getStatistics(StatisticsRequest request) {
        StatisticsVO vo = new StatisticsVO();

        YearMonth start = YearMonth.parse(request.getStartPeriod());
        YearMonth end = YearMonth.parse(request.getEndPeriod());

        LocalDate startDate = start.atDay(1);
        LocalDate endDate = end.atEndOfMonth();

        vo.setPeriod(start + " ~ " + end);

        long totalCrew = crewMemberMapper.selectCount(
                new LambdaQueryWrapper<CrewMember>().ne(CrewMember::getStatus, "GROUNDED"));
        Double totalDutyHours = rosterMapper.sumDutyHoursByCrewAndDateRange(null, startDate, endDate);
        double totalHours = totalDutyHours != null ? totalDutyHours : 0;
        double maxPossibleHours = totalCrew * 100;
        vo.setAvgUtilizationRate(maxPossibleHours > 0 ? totalHours / maxPossibleHours * 100 : 0);

        long totalViolations = conflictRecordMapper.selectCount(
                new LambdaQueryWrapper<ConflictRecord>()
                        .between(ConflictRecord::getCreateTime, startDate.atStartOfDay(), endDate.atTime(23, 59, 59)));
        vo.setTotalViolations((int) totalViolations);

        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .between(Roster::getRosterDate, startDate, endDate)
        );

        double avgFatigue = rosters.stream()
                .mapToDouble(r -> r.getFatigueScore() != null ? r.getFatigueScore() : 0)
                .average().orElse(0);
        vo.setAvgFatigueScore(avgFatigue);

        long highFatigue = rosters.stream()
                .filter(r -> r.getFatigueScore() != null && r.getFatigueScore() > 70)
                .count();
        vo.setHighFatigueCount((int) highFatigue);

        Map<String, Integer> violationsByType = new HashMap<>();
        List<ConflictRecord> conflicts = conflictRecordMapper.selectList(
                new LambdaQueryWrapper<ConflictRecord>()
                        .between(ConflictRecord::getCreateTime, startDate.atStartOfDay(), endDate.atTime(23, 59, 59)));
        conflicts.stream()
                .collect(Collectors.groupingBy(ConflictRecord::getConflictType, Collectors.counting()))
                .forEach((k, v) -> violationsByType.put(k, v.intValue()));
        vo.setViolationsByType(violationsByType);

        Map<String, Double> fatigueDist = new LinkedHashMap<>();
        fatigueDist.put("0-30", rosters.stream().filter(r -> r.getFatigueScore() != null && r.getFatigueScore() <= 30).count() * 1.0);
        fatigueDist.put("30-50", rosters.stream().filter(r -> r.getFatigueScore() != null && r.getFatigueScore() > 30 && r.getFatigueScore() <= 50).count() * 1.0);
        fatigueDist.put("50-70", rosters.stream().filter(r -> r.getFatigueScore() != null && r.getFatigueScore() > 50 && r.getFatigueScore() <= 70).count() * 1.0);
        fatigueDist.put("70-100", rosters.stream().filter(r -> r.getFatigueScore() != null && r.getFatigueScore() > 70).count() * 1.0);
        vo.setFatigueDistribution(fatigueDist);

        Map<String, Integer> manpowerGap = new HashMap<>();
        List<CrewMember> allCrew = crewMemberMapper.selectList(null);
        Map<String, Long> byBase = allCrew.stream()
                .filter(c -> c.getBase() != null)
                .collect(Collectors.groupingBy(CrewMember::getBase, Collectors.counting()));
        byBase.forEach((base, count) -> {
            long onDuty = allCrew.stream()
                    .filter(c -> base.equals(c.getBase()) && "ON_DUTY".equals(c.getStatus()))
                    .count();
            int gap = (int) (count - onDuty);
            manpowerGap.put(base, gap);
        });
        vo.setManpowerGap(manpowerGap);

        return vo;
    }

    public List<StatisticsVO> getMonthlyStatistics(String startPeriod, String endPeriod) {
        YearMonth start = YearMonth.parse(startPeriod);
        YearMonth end = YearMonth.parse(endPeriod);
        List<StatisticsVO> result = new ArrayList<>();

        for (YearMonth ym = start; !ym.isAfter(end); ym = ym.plusMonths(1)) {
            StatisticsRequest req = new StatisticsRequest();
            req.setStartPeriod(ym.toString());
            req.setEndPeriod(ym.toString());
            req.setPeriodType("MONTHLY");
            result.add(getStatistics(req));
        }

        return result;
    }
}
