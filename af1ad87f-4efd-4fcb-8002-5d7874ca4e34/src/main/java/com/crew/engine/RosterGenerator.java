package com.crew.engine;

import com.crew.entity.CrewMember;
import com.crew.entity.Flight;
import com.crew.entity.Roster;
import com.crew.mapper.CrewMemberMapper;
import com.crew.mapper.FlightMapper;
import com.crew.mapper.RosterMapper;
import com.crew.service.QualificationService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

import com.crew.dto.RosterPlanScore;
import com.crew.entity.CrewMember;
import com.crew.entity.Flight;
import com.crew.entity.Roster;

@Slf4j
@Component
@RequiredArgsConstructor
public class RosterGenerator {

    private final CrewMemberMapper crewMemberMapper;
    private final FlightMapper flightMapper;
    private final RosterMapper rosterMapper;
    private final QualificationService qualificationService;

    @Value("${crew.scheduling.duty.max-continuous-hours:14}")
    private double maxContinuousHours;

    @Value("${crew.scheduling.duty.max-weekly-hours:60}")
    private double maxWeeklyHours;

    @Value("${crew.scheduling.duty.max-monthly-hours:100}")
    private double maxMonthlyHours;

    @Value("${crew.scheduling.duty.timezone-recovery-hours:0.5}")
    private double timezoneRecoveryHours;

    @Value("${crew.scheduling.fatigue.risk-score-threshold:70}")
    private double fatigueThreshold;

    @Value("${crew.scheduling.generation-timeout-minutes:10}")
    private int timeoutMinutes;

    public List<Roster> generate(LocalDate month, String optimizeGoal) {
        long startTime = System.currentTimeMillis();
        LocalDate startDate = month.withDayOfMonth(1);
        LocalDate endDate = month.withDayOfMonth(month.lengthOfMonth());

        List<Flight> flights = flightMapper.selectList(
                new LambdaQueryWrapper<Flight>()
                        .ge(Flight::getDepartureTime, startDate.atStartOfDay())
                        .le(Flight::getDepartureTime, endDate.atTime(23, 59, 59))
                        .orderByAsc(Flight::getDepartureTime)
        );

        List<CrewMember> allCrew = crewMemberMapper.selectList(
                new LambdaQueryWrapper<CrewMember>()
                        .eq(CrewMember::getStatus, "AVAILABLE")
        );

        List<CrewMember> pilots = allCrew.stream()
                .filter(c -> "PILOT".equals(c.getType()))
                .collect(Collectors.toList());

        List<CrewMember> attendants = allCrew.stream()
                .filter(c -> "ATTENDANT".equals(c.getType()))
                .collect(Collectors.toList());

        log.info("排班生成开始: month={}, flights={}, pilots={}, attendants={}",
                month, flights.size(), pilots.size(), attendants.size());

        List<Roster> result = new ArrayList<>();
        Map<Long, CrewDutyState> dutyStates = new ConcurrentHashMap<>();

        for (CrewMember crew : allCrew) {
            dutyStates.put(crew.getId(), new CrewDutyState(crew));
        }

        List<Flight> sortedFlights = flights.stream()
                .sorted(Comparator.comparing(Flight::getDepartureTime))
                .collect(Collectors.toList());

        for (Flight flight : sortedFlights) {
            long elapsed = System.currentTimeMillis() - startTime;
            if (elapsed > timeoutMinutes * 60 * 1000L) {
                log.warn("排班生成超时: 已耗时{}分钟", elapsed / 60000);
                throw new RuntimeException("排班生成超时");
            }

            List<CrewMember> qualifiedPilots = findQualifiedCrew(
                    pilots, flight, dutyStates, startDate, endDate, "PILOT");

            List<CrewMember> qualifiedAttendants = findQualifiedCrew(
                    attendants, flight, dutyStates, startDate, endDate, "ATTENDANT");

            int requiredPilots = flight.getRequiredPilots() != null ? flight.getRequiredPilots() : 2;
            int requiredAttendants = flight.getRequiredAttendants() != null ? flight.getRequiredAttendants() : 4;

            List<CrewMember> assignedPilots = selectByStrategy(
                    qualifiedPilots, requiredPilots, flight, dutyStates, optimizeGoal);

            List<CrewMember> assignedAttendants = selectByStrategy(
                    qualifiedAttendants, requiredAttendants, flight, dutyStates, optimizeGoal);

            LocalDate rosterDate = flight.getDepartureTime().toLocalDate();
            double dutyHours = ChronoUnit.MINUTES.between(flight.getDepartureTime(), flight.getArrivalTime()) / 60.0;

            for (CrewMember pilot : assignedPilots) {
                Roster roster = createRoster(pilot, flight, rosterDate, dutyHours, "PILOT");
                result.add(roster);
                updateDutyState(dutyStates, pilot.getId(), flight, dutyHours);
            }

            for (CrewMember attendant : assignedAttendants) {
                Roster roster = createRoster(attendant, flight, rosterDate, dutyHours, "ATTENDANT");
                result.add(roster);
                updateDutyState(dutyStates, attendant.getId(), flight, dutyHours);
            }
        }

        long totalTime = System.currentTimeMillis() - startTime;
        log.info("排班生成完成: 总条数={}, 耗时={}秒", result.size(), totalTime / 1000);

        return result;
    }

    private List<CrewMember> findQualifiedCrew(List<CrewMember> crewPool, Flight flight,
                                                Map<Long, CrewDutyState> dutyStates,
                                                LocalDate startDate, LocalDate endDate,
                                                String crewType) {
        return crewPool.stream()
                .filter(crew -> {
                    if (!qualificationService.isCrewQualified(crew.getId(), flight.getAircraftType(), flight.getLanguageRequired())) {
                        return false;
                    }

                    if ("LEAVE".equals(crew.getStatus()) || "GROUNDED".equals(crew.getStatus())) {
                        return false;
                    }

                    CrewDutyState state = dutyStates.get(crew.getId());
                    if (state == null) return true;

                    if (state.currentDutyHours + estimateDutyHours(flight) > maxContinuousHours) {
                        return false;
                    }

                    Double weeklyHours = rosterMapper.sumDutyHoursByCrewAndDateRange(
                            crew.getId(),
                            flight.getDepartureTime().toLocalDate().minusDays(6),
                            flight.getDepartureTime().toLocalDate()
                    );
                    if (weeklyHours != null && weeklyHours + estimateDutyHours(flight) > maxWeeklyHours) {
                        return false;
                    }

                    Double monthlyHours = rosterMapper.sumDutyHoursByCrewAndDateRange(
                            crew.getId(), startDate, endDate
                    );
                    if (monthlyHours != null && monthlyHours + estimateDutyHours(flight) > maxMonthlyHours) {
                        return false;
                    }

                    if (state.lastDutyEnd != null) {
                        long restHours = ChronoUnit.HOURS.between(state.lastDutyEnd, flight.getDepartureTime());
                        double requiredRest = 10 + state.timezoneCrossings * timezoneRecoveryHours;
                        if (restHours < requiredRest) {
                            return false;
                        }
                    }

                    double fatigueScore = calculateFatigueScore(state, flight);
                    if (fatigueScore > fatigueThreshold) {
                        return false;
                    }

                    return true;
                })
                .collect(Collectors.toList());
    }

    private List<CrewMember> selectByStrategy(List<CrewMember> candidates, int required,
                                               Flight flight, Map<Long, CrewDutyState> dutyStates,
                                               String optimizeGoal) {
        if (candidates.size() <= required) {
            return new ArrayList<>(candidates);
        }

        Comparator<CrewMember> comparator;
        switch (optimizeGoal) {
            case "MIN_FATIGUE":
                comparator = Comparator.comparingDouble(c -> {
                    CrewDutyState state = dutyStates.get(c.getId());
                    return state != null ? state.totalMonthlyHours : 0;
                });
                break;
            case "MAX_UTILIZATION":
                comparator = Comparator.comparingDouble(c -> {
                    CrewDutyState state = dutyStates.get(c.getId());
                    return -(state != null ? state.totalMonthlyHours : 0);
                });
                break;
            case "BALANCED":
            default:
                comparator = Comparator.comparingDouble(c -> {
                    CrewDutyState state = dutyStates.get(c.getId());
                    if (state == null) return 0;
                    return state.totalWeeklyHours + state.consecutiveDays * 5;
                });
                break;
        }

        return candidates.stream()
                .sorted(comparator)
                .limit(required)
                .collect(Collectors.toList());
    }

    private double calculateFatigueScore(CrewDutyState state, Flight flight) {
        double score = 0;

        score += (state.totalWeeklyHours / maxWeeklyHours) * 30;
        score += (state.totalMonthlyHours / maxMonthlyHours) * 20;
        score += Math.min(state.consecutiveDays * 5, 25);

        if (Boolean.TRUE.equals(flight.getIsRedEye())) {
            score += 15;
        }

        score += Math.abs(flight.getTimezoneDiff() != null ? flight.getTimezoneDiff() : 0) * 2;

        return Math.min(score, 100);
    }

    private double estimateDutyHours(Flight flight) {
        double flightHours = ChronoUnit.MINUTES.between(flight.getDepartureTime(), flight.getArrivalTime()) / 60.0;
        return flightHours + 1.0;
    }

    private Roster createRoster(CrewMember crew, Flight flight, LocalDate rosterDate,
                                 double dutyHours, String dutyRole) {
        Roster roster = new Roster();
        roster.setCrewId(crew.getId());
        roster.setFlightId(flight.getId());
        roster.setRosterDate(rosterDate);
        roster.setDutyRole(dutyRole);
        roster.setStatus("DRAFT");
        roster.setReportTime(flight.getDepartureTime().minusHours(1));
        roster.setReleaseTime(flight.getArrivalTime().plusMinutes(30));
        roster.setDutyHours(dutyHours + 1.5);
        roster.setTimezoneCrossings(flight.getTimezoneDiff());
        roster.setIsRedEye(flight.getIsRedEye());
        return roster;
    }

    private void updateDutyState(Map<Long, CrewDutyState> states, Long crewId,
                                  Flight flight, double dutyHours) {
        CrewDutyState state = states.computeIfAbsent(crewId, k -> new CrewDutyState());
        state.currentDutyHours += dutyHours + 1.5;
        state.totalWeeklyHours += dutyHours + 1.5;
        state.totalMonthlyHours += dutyHours + 1.5;
        state.lastDutyEnd = flight.getArrivalTime().plusMinutes(30);
        state.consecutiveDays++;
        if (flight.getTimezoneDiff() != null) {
            state.timezoneCrossings += Math.abs(flight.getTimezoneDiff());
        }
    }

    public List<Map<String, Object>> detectConflicts(List<Roster> rosters) {
        List<Map<String, Object>> conflicts = new ArrayList<>();
        Map<Long, List<Roster>> crewRosters = rosters.stream()
                .collect(Collectors.groupingBy(Roster::getCrewId));

        for (Map.Entry<Long, List<Roster>> entry : crewRosters.entrySet()) {
            List<Roster> crewDuties = entry.getValue();
            crewDuties.sort(Comparator.comparing(Roster::getReportTime));

            for (int i = 0; i < crewDuties.size(); i++) {
                Roster current = crewDuties.get(i);

                if (current.getDutyHours() > maxContinuousHours) {
                    Map<String, Object> conflict = new HashMap<>();
                    conflict.put("rosterId", current.getId());
                    conflict.put("crewId", current.getCrewId());
                    conflict.put("conflictType", "OVERTIME");
                    conflict.put("description", String.format("执勤时长%.1f小时超过上限%.0f小时", current.getDutyHours(), maxContinuousHours));
                    conflict.put("suggestion", "拆分执勤段或安排替换人员");
                    conflicts.add(conflict);
                }

                if (i > 0) {
                    Roster previous = crewDuties.get(i - 1);
                    if (previous.getReleaseTime() != null && current.getReportTime() != null) {
                        long restHours = ChronoUnit.HOURS.between(previous.getReleaseTime(), current.getReportTime());
                        int tzCross = previous.getTimezoneCrossings() != null ? previous.getTimezoneCrossings() : 0;
                        double requiredRest = 10 + Math.abs(tzCross) * timezoneRecoveryHours;
                        if (restHours < requiredRest) {
                            Map<String, Object> conflict = new HashMap<>();
                            conflict.put("rosterId", current.getId());
                            conflict.put("crewId", current.getCrewId());
                            conflict.put("conflictType", "INSUFFICIENT_REST");
                            conflict.put("description", String.format("休息时间%d小时不足（需%.1f小时）", restHours, requiredRest));
                            conflict.put("suggestion", "调整航班安排或替换人员");
                            conflicts.add(conflict);
                        }
                    }
                }
            }
        }

        return conflicts;
    }

    public static class GeneratedPlan {
        public List<Roster> rosters;
        public String optimizeGoal;
        public RosterPlanScore score;

        public GeneratedPlan(List<Roster> rosters, String optimizeGoal) {
            this.rosters = rosters;
            this.optimizeGoal = optimizeGoal;
        }
    }

    public List<GeneratedPlan> generateMultiplePlans(LocalDate month, int planCount) {
        List<GeneratedPlan> plans = new ArrayList<>();
        String[] goals = {"BALANCED", "MIN_FATIGUE", "MAX_UTILIZATION"};

        for (int i = 0; i < Math.min(planCount, goals.length); i++) {
            String goal = goals[i];
            List<Roster> rosters = generate(month, goal);
            GeneratedPlan plan = new GeneratedPlan(rosters, goal);
            plan.score = scorePlan(rosters, goal);
            plans.add(plan);
        }

        plans.sort(Comparator.comparingDouble(p -> -p.score.getCompositeScore()));
        return plans;
    }

    public RosterPlanScore scorePlan(List<Roster> rosters, String optimizeGoal) {
        RosterPlanScore score = new RosterPlanScore();
        score.setOptimizeGoal(optimizeGoal);

        int totalFlights = (int) rosters.stream().map(Roster::getFlightId).distinct().count();
        int totalCrew = (int) rosters.stream().map(Roster::getCrewId).distinct().count();
        int totalAssignments = rosters.size();

        double avgDutyHours = rosters.stream()
                .mapToDouble(r -> r.getDutyHours() != null ? r.getDutyHours() : 0)
                .average().orElse(0);

        double hourStdDev = 0;
        if (!rosters.isEmpty()) {
            Map<Long, Double> crewHours = new HashMap<>();
            for (Roster r : rosters) {
                crewHours.merge(r.getCrewId(), r.getDutyHours() != null ? r.getDutyHours() : 0, Double::sum);
            }
            double mean = crewHours.values().stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double variance = crewHours.values().stream()
                    .mapToDouble(h -> Math.pow(h - mean, 2))
                    .average().orElse(0);
            hourStdDev = Math.sqrt(variance);
        }

        double avgFatigue = rosters.stream()
                .mapToDouble(r -> r.getFatigueScore() != null ? r.getFatigueScore() : 0)
                .average().orElse(0);

        List<Map<String, Object>> conflicts = detectConflicts(rosters);
        int violationCount = conflicts.size();

        double maxPossibleAssignments = totalCrew * (totalFlights > 0 ? totalAssignments / (double) Math.max(totalCrew, 1) : 0);
        double utilizationRate = totalCrew > 0 ? avgDutyHours / maxMonthlyHours * 100 : 0;

        double utilizationScore = Math.min(utilizationRate / 80.0 * 30, 30);
        double complianceScore = Math.max(0, 30 - violationCount * 5);
        double fatigueScore = Math.max(0, 25 - (avgFatigue / 50.0 * 25));
        double balanceScore = hourStdDev < 5 ? 15 : Math.max(0, 15 - (hourStdDev - 5));

        double compositeScore = utilizationScore + complianceScore + fatigueScore + balanceScore;

        switch (optimizeGoal) {
            case "MIN_FATIGUE":
                fatigueScore = Math.min(fatigueScore * 1.5, 35);
                compositeScore = utilizationScore * 0.8 + complianceScore + fatigueScore * 1.5 + balanceScore;
                break;
            case "MAX_UTILIZATION":
                utilizationScore = Math.min(utilizationScore * 1.5, 40);
                compositeScore = utilizationScore * 1.5 + complianceScore + fatigueScore * 0.8 + balanceScore;
                break;
            case "BALANCED":
            default:
                break;
        }

        score.setUtilizationScore(Math.round(utilizationScore * 100) / 100.0);
        score.setComplianceScore(Math.round(complianceScore * 100) / 100.0);
        score.setFatigueScore(Math.round(fatigueScore * 100) / 100.0);
        score.setBalanceScore(Math.round(balanceScore * 100) / 100.0);
        score.setCompositeScore(Math.round(compositeScore * 100) / 100.0);
        score.setUtilizationRate(Math.round(utilizationRate * 100) / 100.0);
        score.setViolationCount(violationCount);
        score.setAvgFatigue(Math.round(avgFatigue * 100) / 100.0);
        score.setHourStdDev(Math.round(hourStdDev * 100) / 100.0);

        return score;
    }

    private static class CrewDutyState {
        double currentDutyHours = 0;
        double totalWeeklyHours = 0;
        double totalMonthlyHours = 0;
        int consecutiveDays = 0;
        int timezoneCrossings = 0;
        LocalDateTime lastDutyEnd = null;

        CrewDutyState() {}

        CrewDutyState(CrewMember crew) {
            this.totalWeeklyHours = crew.getWeeklyFlightHours() != null ? crew.getWeeklyFlightHours() : 0;
            this.totalMonthlyHours = crew.getMonthlyFlightHours() != null ? crew.getMonthlyFlightHours() : 0;
            this.consecutiveDays = crew.getConsecutiveDutyDays() != null ? crew.getConsecutiveDutyDays() : 0;
            this.lastDutyEnd = crew.getLastDutyEnd();
        }
    }
}
