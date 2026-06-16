package com.crew.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.crew.dto.DrillDownVO;
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
import java.util.Comparator;

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
    private final FlightMapper flightMapper;

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

    public DrillDownVO drillDownByAircraft(String startPeriod, String endPeriod, String aircraftType) {
        YearMonth start = YearMonth.parse(startPeriod);
        YearMonth end = YearMonth.parse(endPeriod);
        LocalDate startDate = start.atDay(1);
        LocalDate endDate = end.atEndOfMonth();

        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .between(Roster::getRosterDate, startDate, endDate)
        );

        Map<Long, Flight> flightMap = flightMapper.selectList(null).stream()
                .collect(Collectors.toMap(Flight::getId, f -> f));

        List<Roster> filtered = rosters.stream()
                .filter(r -> {
                    Flight f = flightMap.get(r.getFlightId());
                    return f != null && aircraftType.equalsIgnoreCase(f.getAircraftType());
                })
                .collect(Collectors.toList());

        DrillDownVO vo = buildDrillDown(start, end, "AIRCRAFT", aircraftType, filtered, flightMap);

        Map<String, Object> subDist = new LinkedHashMap<>();
        filtered.stream()
                .collect(Collectors.groupingBy(r -> {
                    CrewMember c = crewMemberMapper.selectById(r.getCrewId());
                    return c != null ? c.getName() : ("id:" + r.getCrewId());
                }, Collectors.counting()))
                .forEach((name, count) -> subDist.put(name, count));
        vo.setSubDistribution(subDist);

        return vo;
    }

    public DrillDownVO drillDownByRoute(String startPeriod, String endPeriod,
                                         String departure, String arrival) {
        YearMonth start = YearMonth.parse(startPeriod);
        YearMonth end = YearMonth.parse(endPeriod);
        LocalDate startDate = start.atDay(1);
        LocalDate endDate = end.atEndOfMonth();

        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .between(Roster::getRosterDate, startDate, endDate)
        );

        Map<Long, Flight> flightMap = flightMapper.selectList(null).stream()
                .collect(Collectors.toMap(Flight::getId, f -> f));

        String routeKey = (departure + "-" + arrival).toUpperCase();
        List<Roster> filtered = rosters.stream()
                .filter(r -> {
                    Flight f = flightMap.get(r.getFlightId());
                    if (f == null) return false;
                    String rk = (f.getDeparture() + "-" + f.getArrival()).toUpperCase();
                    return routeKey.equals(rk);
                })
                .collect(Collectors.toList());

        DrillDownVO vo = buildDrillDown(start, end, "ROUTE", routeKey, filtered, flightMap);

        Map<String, Object> subDist = new LinkedHashMap<>();
        filtered.stream()
                .collect(Collectors.groupingBy(r -> {
                    Flight f = flightMap.get(r.getFlightId());
                    return f != null ? f.getFlightNo() : "unknown";
                }, Collectors.counting()))
                .forEach((fn, count) -> subDist.put(fn, count));
        vo.setSubDistribution(subDist);

        return vo;
    }

    public DrillDownVO drillDownByCrew(String startPeriod, String endPeriod, Long crewId) {
        YearMonth start = YearMonth.parse(startPeriod);
        YearMonth end = YearMonth.parse(endPeriod);
        LocalDate startDate = start.atDay(1);
        LocalDate endDate = end.atEndOfMonth();

        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .eq(Roster::getCrewId, crewId)
                        .between(Roster::getRosterDate, startDate, endDate)
        );

        Map<Long, Flight> flightMap = flightMapper.selectList(null).stream()
                .collect(Collectors.toMap(Flight::getId, f -> f));

        CrewMember crew = crewMemberMapper.selectById(crewId);
        String label = crew != null ? crew.getName() : ("crew-" + crewId);

        DrillDownVO vo = buildDrillDown(start, end, "CREW", label, rosters, flightMap);

        Map<String, Object> subDist = new LinkedHashMap<>();
        rosters.stream()
                .collect(Collectors.groupingBy(r -> {
                    Flight f = flightMap.get(r.getFlightId());
                    return f != null ? f.getAircraftType() : "unknown";
                }, Collectors.counting()))
                .forEach((type, count) -> subDist.put(type, count));
        vo.setSubDistribution(subDist);

        return vo;
    }

    public DrillDownVO drillDownByBase(String startPeriod, String endPeriod, String base) {
        YearMonth start = YearMonth.parse(startPeriod);
        YearMonth end = YearMonth.parse(endPeriod);
        LocalDate startDate = start.atDay(1);
        LocalDate endDate = end.atEndOfMonth();

        List<CrewMember> baseCrew = crewMemberMapper.selectList(
                new LambdaQueryWrapper<CrewMember>().eq(CrewMember::getBase, base)
        );
        List<Long> crewIds = baseCrew.stream().map(CrewMember::getId).collect(Collectors.toList());

        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .between(Roster::getRosterDate, startDate, endDate)
        );

        List<Roster> filtered = rosters.stream()
                .filter(r -> crewIds.contains(r.getCrewId()))
                .collect(Collectors.toList());

        Map<Long, Flight> flightMap = flightMapper.selectList(null).stream()
                .collect(Collectors.toMap(Flight::getId, f -> f));

        DrillDownVO vo = buildDrillDown(start, end, "BASE", base, filtered, flightMap);

        Map<String, Object> subDist = new LinkedHashMap<>();
        filtered.stream()
                .collect(Collectors.groupingBy(r -> {
                    CrewMember c = crewMemberMapper.selectById(r.getCrewId());
                    return c != null ? c.getType() : "unknown";
                }, Collectors.counting()))
                .forEach((type, count) -> subDist.put(type, count));
        vo.setSubDistribution(subDist);

        return vo;
    }

    public List<DrillDownVO> listAllAircraft(String startPeriod, String endPeriod) {
        List<Flight> flights = flightMapper.selectList(null);
        return flights.stream()
                .map(Flight::getAircraftType)
                .filter(Objects::nonNull)
                .distinct()
                .map(type -> drillDownByAircraft(startPeriod, endPeriod, type))
                .sorted(Comparator.comparingDouble((DrillDownVO d) -> d.getUtilizationRate() != null ? d.getUtilizationRate() : 0).reversed())
                .collect(Collectors.toList());
    }

    public List<DrillDownVO> listAllBases(String startPeriod, String endPeriod) {
        List<CrewMember> crew = crewMemberMapper.selectList(null);
        return crew.stream()
                .map(CrewMember::getBase)
                .filter(Objects::nonNull)
                .distinct()
                .map(b -> drillDownByBase(startPeriod, endPeriod, b))
                .sorted(Comparator.comparingDouble((DrillDownVO d) -> d.getUtilizationRate() != null ? d.getUtilizationRate() : 0).reversed())
                .collect(Collectors.toList());
    }

    private DrillDownVO buildDrillDown(YearMonth start, YearMonth end, String dimension,
                                       String dimensionValue, List<Roster> rosters,
                                       Map<Long, Flight> flightMap) {
        DrillDownVO vo = new DrillDownVO();
        vo.setPeriod(start + " ~ " + end);
        vo.setDimension(dimension);
        vo.setDimensionValue(dimensionValue);
        vo.setAssignmentCount(rosters.size());

        double totalHours = rosters.stream()
                .mapToDouble(r -> r.getDutyHours() != null ? r.getDutyHours() : 0)
                .sum();
        vo.setTotalDutyHours(Math.round(totalHours * 100) / 100.0);

        int crewCount = (int) rosters.stream().map(Roster::getCrewId).distinct().count();
        vo.setCrewCount(crewCount);

        double maxPossible = crewCount * 100.0;
        vo.setUtilizationRate(maxPossible > 0 ? Math.round(totalHours / maxPossible * 10000) / 100.0 : 0);

        double avgFatigue = rosters.stream()
                .mapToDouble(r -> r.getFatigueScore() != null ? r.getFatigueScore() : 0)
                .average().orElse(0);
        vo.setAvgFatigueScore(Math.round(avgFatigue * 100) / 100.0);

        long highFatigue = rosters.stream()
                .filter(r -> r.getFatigueScore() != null && r.getFatigueScore() > 70)
                .count();
        vo.setHighFatigueCount((int) highFatigue);

        List<Map<String, Object>> allConflicts = rosterMapper != null
                ? new ArrayList<>()
                : new ArrayList<>();
        LocalDate startDate = start.atDay(1);
        LocalDate endDate = end.atEndOfMonth();
        List<ConflictRecord> conflicts = conflictRecordMapper.selectList(
                new LambdaQueryWrapper<ConflictRecord>()
                        .between(ConflictRecord::getCreateTime, startDate.atStartOfDay(), endDate.atTime(23, 59, 59))
        );
        List<Long> rosterIds = rosters.stream().map(Roster::getId).collect(Collectors.toList());
        int violations = (int) conflicts.stream()
                .filter(c -> rosterIds.contains(c.getRosterId()))
                .count();
        vo.setViolationCount(violations);

        return vo;
    }
}
