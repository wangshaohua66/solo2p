package com.crew.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crew.common.BusinessException;
import com.crew.common.ErrorCode;
import com.crew.common.PageResult;
import com.crew.dto.ConflictVO;
import com.crew.dto.RosterGenerateRequest;
import com.crew.dto.RosterPlanCompareVO;
import com.crew.dto.RosterPlanScore;
import com.crew.dto.RosterPlanVO;
import com.crew.dto.SwapCandidateVO;
import com.crew.dto.SwapRequestDTO;
import com.crew.engine.RosterGenerator;
import com.crew.entity.*;
import com.crew.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RosterService {

    private final RosterMapper rosterMapper;
    private final RosterPlanMapper rosterPlanMapper;
    private final RosterGenerator rosterGenerator;
    private final CrewMemberMapper crewMemberMapper;
    private final FlightMapper flightMapper;
    private final SwapRequestMapper swapRequestMapper;
    private final ConflictRecordMapper conflictRecordMapper;
    private final QualificationService qualificationService;

    private final Map<String, CompletableFuture<List<Roster>>> generationTasks = new ConcurrentHashMap<>();

    @Transactional
    public RosterPlanCompareVO generate(RosterGenerateRequest request) {
        LocalDate month = request.getMonth();
        int planCount = request.getPlanCount() != null ? request.getPlanCount() : 3;

        long existing = rosterPlanMapper.selectCount(
                new LambdaQueryWrapper<RosterPlan>()
                        .eq(RosterPlan::getMonth, month)
                        .eq(RosterPlan::getStatus, "DRAFT")
        );
        if (existing > 0) {
            throw new BusinessException(ErrorCode.ROSTER_CONFLICT.getCode(), "该月份已有待审批方案");
        }

        List<RosterGenerator.GeneratedPlan> generatedPlans =
                rosterGenerator.generateMultiplePlans(month, planCount);

        List<RosterPlanVO> planVOs = new ArrayList<>();
        long recommendedId = null;
        double bestScore = -1;

        for (int i = 0; i < generatedPlans.size(); i++) {
            RosterGenerator.GeneratedPlan gp = generatedPlans.get(i);
            RosterPlan plan = new RosterPlan();
            plan.setPlanNo("RP-" + month.toString().replace("-", "") + "-" + (i + 1) + "-" + System.currentTimeMillis() % 10000);
            plan.setMonth(month);
            plan.setStatus("DRAFT");
            plan.setTotalFlights((int) gp.rosters.stream().map(Roster::getFlightId).distinct().count());
            plan.setTotalCrewAssigned((int) gp.rosters.stream().map(Roster::getCrewId).distinct().count());
            plan.setViolationCount(gp.score.getViolationCount());
            plan.setAvgFatigueScore(gp.score.getAvgFatigue());
            plan.setGeneratedAt(LocalDateTime.now());
            plan.setRemark("优化目标: " + gp.optimizeGoal);
            rosterPlanMapper.insert(plan);

            for (Roster roster : gp.rosters) {
                roster.setRosterNo("RS-" + plan.getPlanNo() + "-" + roster.getCrewId());
                roster.setStatus("DRAFT");
                roster.setFatigueScore(gp.score.getAvgFatigue());
                rosterMapper.insert(roster);
            }

            List<Map<String, Object>> conflicts = rosterGenerator.detectConflicts(gp.rosters);
            for (Map<String, Object> conflict : conflicts) {
                ConflictRecord record = new ConflictRecord();
                record.setRosterId((Long) conflict.get("rosterId"));
                record.setCrewId((Long) conflict.get("crewId"));
                record.setConflictType((String) conflict.get("conflictType"));
                record.setDescription((String) conflict.get("description"));
                record.setSuggestion((String) conflict.get("suggestion"));
                record.setStatus("OPEN");
                conflictRecordMapper.insert(record);
            }

            RosterPlanVO planVO = convertToPlanVO(plan, gp.rosters);
            planVO.setOptimizeGoal(gp.optimizeGoal);
            planVO.setScore(gp.score);
            planVOs.add(planVO);

            if (gp.score.getCompositeScore() > bestScore) {
                bestScore = gp.score.getCompositeScore();
                recommendedId = plan.getId();
            }
        }

        RosterPlanCompareVO compareVO = new RosterPlanCompareVO();
        compareVO.setPlanCount(planVOs.size());
        compareVO.setRecommendedPlanId(recommendedId);
        compareVO.setPlans(planVOs);

        log.info("多方案排班生成完成: month={}, planCount={}, recommendedId={}", month, planVOs.size(), recommendedId);
        return compareVO;
    }

    @Transactional
    public RosterPlanVO selectPlan(Long planId, String operator) {
        RosterPlan selectedPlan = rosterPlanMapper.selectById(planId);
        if (selectedPlan == null) {
            throw new BusinessException(ErrorCode.ROSTER_NOT_FOUND);
        }

        LocalDate month = selectedPlan.getMonth();

        List<RosterPlan> monthPlans = rosterPlanMapper.selectList(
                new LambdaQueryWrapper<RosterPlan>()
                        .eq(RosterPlan::getMonth, month)
        );

        for (RosterPlan p : monthPlans) {
            if (p.getId().equals(planId)) {
                continue;
            }
            p.setStatus("REJECTED");
            rosterPlanMapper.updateById(p);

            List<Roster> rosters = rosterMapper.selectList(
                    new LambdaQueryWrapper<Roster>()
                            .likeRight(Roster::getRosterNo, "RS-" + p.getPlanNo())
            );
            for (Roster r : rosters) {
                r.setStatus("CANCELLED");
                rosterMapper.updateById(r);
            }
        }

        selectedPlan.setStatus("SELECTED");
        selectedPlan.setApprovedBy(operator);
        selectedPlan.setApprovedAt(LocalDateTime.now());
        rosterPlanMapper.updateById(selectedPlan);

        List<Roster> selectedRosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .likeRight(Roster::getRosterNo, "RS-" + selectedPlan.getPlanNo())
        );
        for (Roster r : selectedRosters) {
            r.setStatus("APPROVED");
            rosterMapper.updateById(r);
        }

        RosterPlanVO vo = convertToPlanVO(selectedPlan, selectedRosters);
        vo.setOptimizeGoal(selectedPlan.getRemark() != null && selectedPlan.getRemark().startsWith("优化目标: ")
                ? selectedPlan.getRemark().substring(5) : null);

        log.info("排班方案已选择: planId={}, operator={}", planId, operator);
        return vo;
    }

    @Transactional
    public void approve(Long planId, String approvedBy) {
        RosterPlan plan = rosterPlanMapper.selectById(planId);
        if (plan == null) {
            throw new BusinessException(ErrorCode.ROSTER_NOT_FOUND);
        }
        if ("APPROVED".equals(plan.getStatus())) {
            throw new BusinessException(ErrorCode.ROSTER_ALREADY_APPROVED);
        }

        plan.setStatus("APPROVED");
        plan.setApprovedAt(LocalDateTime.now());
        plan.setApprovedBy(approvedBy);
        rosterPlanMapper.updateById(plan);

        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .eq(Roster::getRosterNo, plan.getPlanNo())
                        .or()
                        .likeRight(Roster::getRosterNo, "RS-" + plan.getPlanNo())
        );

        for (Roster roster : rosters) {
            roster.setStatus("APPROVED");
            rosterMapper.updateById(roster);
        }
    }

    public PageResult<Roster> query(LocalDate startDate, LocalDate endDate, Long crewId,
                                     String status, int page, int size) {
        LambdaQueryWrapper<Roster> wrapper = new LambdaQueryWrapper<>();
        if (startDate != null) wrapper.ge(Roster::getRosterDate, startDate);
        if (endDate != null) wrapper.le(Roster::getRosterDate, endDate);
        if (crewId != null) wrapper.eq(Roster::getCrewId, crewId);
        if (status != null) wrapper.eq(Roster::getStatus, status);
        wrapper.orderByAsc(Roster::getRosterDate, Roster::getReportTime);

        IPage<Roster> result = rosterMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    public RosterPlanVO getPlanDetail(Long planId) {
        RosterPlan plan = rosterPlanMapper.selectById(planId);
        if (plan == null) {
            throw new BusinessException(ErrorCode.ROSTER_NOT_FOUND);
        }

        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .likeRight(Roster::getRosterNo, "RS-" + plan.getPlanNo())
        );

        return convertToPlanVO(plan, rosters);
    }

    public PageResult<RosterPlan> listPlans(String status, int page, int size) {
        LambdaQueryWrapper<RosterPlan> wrapper = new LambdaQueryWrapper<>();
        if (status != null) wrapper.eq(RosterPlan::getStatus, status);
        wrapper.orderByDesc(RosterPlan::getCreateTime);

        IPage<RosterPlan> result = rosterPlanMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    @Transactional
    public List<SwapCandidateVO> findSwapCandidates(SwapRequestDTO request) {
        Roster roster = rosterMapper.selectById(request.getRosterId());
        if (roster == null) {
            throw new BusinessException(ErrorCode.ROSTER_NOT_FOUND);
        }

        Flight flight = flightMapper.selectById(roster.getFlightId());
        if (flight == null) {
            throw new BusinessException(ErrorCode.PARAM_INVALID.getCode(), "航班信息不存在");
        }

        List<CrewMember> candidates = crewMemberMapper.selectList(
                new LambdaQueryWrapper<CrewMember>()
                        .eq(CrewMember::getType, "PILOT".equals(roster.getDutyRole()) ? "PILOT" : "ATTENDANT")
                        .eq(CrewMember::getStatus, "AVAILABLE")
        );

        List<SwapCandidateVO> result = new ArrayList<>();

        for (CrewMember candidate : candidates) {
            if (candidate.getId().equals(roster.getCrewId())) continue;

            boolean qualMatch = qualificationService.isCrewQualified(
                    candidate.getId(), flight.getAircraftType(), flight.getLanguageRequired());

            Double weeklyHours = rosterMapper.sumDutyHoursByCrewAndDateRange(
                    candidate.getId(),
                    roster.getRosterDate().minusDays(6),
                    roster.getRosterDate()
            );

            double currentWeekly = weeklyHours != null ? weeklyHours : 0;
            boolean restSufficient = true;
            if (candidate.getLastDutyEnd() != null) {
                long restHours = java.time.Duration.between(
                        candidate.getLastDutyEnd(), roster.getReportTime()).toHours();
                restSufficient = restHours >= 10;
            }

            Double fatigueScore = rosterMapper.selectList(
                    new LambdaQueryWrapper<Roster>()
                            .eq(Roster::getCrewId, candidate.getId())
                            .ge(Roster::getRosterDate, roster.getRosterDate().minusDays(6))
            ).stream().mapToDouble(r -> r.getFatigueScore() != null ? r.getFatigueScore() : 0)
                    .average().orElse(0);

            if (qualMatch && restSufficient && currentWeekly + roster.getDutyHours() <= 60 && fatigueScore < 70) {
                SwapCandidateVO vo = new SwapCandidateVO();
                vo.setCrewId(candidate.getId());
                vo.setCrewName(candidate.getName());
                vo.setRank(candidate.getRank());
                vo.setWeeklyRemainingHours(60 - currentWeekly);
                vo.setMonthlyRemainingHours(100 - (candidate.getMonthlyFlightHours() != null ? candidate.getMonthlyFlightHours() : 0));
                vo.setQualificationMatch(true);
                vo.setRestSufficient(true);
                vo.setFatigueScore(fatigueScore);
                vo.setComplianceNote("合规");
                result.add(vo);
            }
        }

        result.sort(Comparator.comparingDouble(SwapCandidateVO::getFatigueScore));

        SwapRequest swapRequest = new SwapRequest();
        swapRequest.setRosterId(request.getRosterId());
        swapRequest.setOriginalCrewId(roster.getCrewId());
        swapRequest.setReason(request.getReason());
        swapRequest.setUrgency(request.getUrgency());
        swapRequest.setStatus("PENDING");
        swapRequestMapper.insert(swapRequest);

        return result;
    }

    @Transactional
    public void applySwap(Long rosterId, Long targetCrewId) {
        Roster roster = rosterMapper.selectById(rosterId);
        if (roster == null) {
            throw new BusinessException(ErrorCode.ROSTER_NOT_FOUND);
        }

        roster.setSwappedFrom(roster.getCrewId());
        roster.setCrewId(targetCrewId);
        roster.setSwapReason("临时调班");
        rosterMapper.updateById(roster);

        log.info("调班成功: rosterId={}, originalCrew={}, newCrew={}", rosterId, roster.getSwappedFrom(), targetCrewId);
    }

    public List<ConflictVO> detectConflicts(LocalDate startDate, LocalDate endDate) {
        List<Roster> rosters = rosterMapper.selectList(
                new LambdaQueryWrapper<Roster>()
                        .ge(Roster::getRosterDate, startDate)
                        .le(Roster::getRosterDate, endDate)
        );

        List<Map<String, Object>> rawConflicts = rosterGenerator.detectConflicts(rosters);

        List<ConflictVO> result = new ArrayList<>();
        for (Map<String, Object> conflict : rawConflicts) {
            ConflictVO vo = new ConflictVO();
            vo.setRosterId((Long) conflict.get("rosterId"));
            vo.setCrewId((Long) conflict.get("crewId"));
            vo.setConflictType((String) conflict.get("conflictType"));
            vo.setDescription((String) conflict.get("description"));
            vo.setSuggestion((String) conflict.get("suggestion"));

            CrewMember crew = crewMemberMapper.selectById(vo.getCrewId());
            if (crew != null) vo.setCrewName(crew.getName());

            Roster r = rosterMapper.selectById(vo.getRosterId());
            if (r != null) {
                Flight f = flightMapper.selectById(r.getFlightId());
                if (f != null) vo.setFlightNo(f.getFlightNo());
            }

            result.add(vo);
        }

        return result;
    }

    private RosterPlanVO convertToPlanVO(RosterPlan plan, List<Roster> rosters) {
        RosterPlanVO vo = new RosterPlanVO();
        vo.setId(plan.getId());
        vo.setPlanNo(plan.getPlanNo());
        vo.setMonth(plan.getMonth());
        vo.setStatus(plan.getStatus());
        vo.setTotalFlights(plan.getTotalFlights());
        vo.setTotalCrewAssigned(plan.getTotalCrewAssigned());
        vo.setViolationCount(plan.getViolationCount());
        vo.setAvgFatigueScore(plan.getAvgFatigueScore());
        vo.setRemark(plan.getRemark());

        List<RosterPlanVO.RosterItemVO> items = rosters.stream().map(r -> {
            RosterPlanVO.RosterItemVO item = new RosterPlanVO.RosterItemVO();
            item.setRosterId(r.getId());
            item.setCrewId(r.getCrewId());
            item.setFlightId(r.getFlightId());
            item.setRosterDate(r.getRosterDate());
            item.setDutyRole(r.getDutyRole());
            item.setDutyHours(r.getDutyHours());
            item.setFatigueScore(r.getFatigueScore());
            item.setTimezoneCrossings(r.getTimezoneCrossings());
            item.setIsRedEye(r.getIsRedEye());

            CrewMember crew = crewMemberMapper.selectById(r.getCrewId());
            if (crew != null) item.setCrewName(crew.getName());

            Flight flight = flightMapper.selectById(r.getFlightId());
            if (flight != null) item.setFlightNo(flight.getFlightNo());

            return item;
        }).collect(Collectors.toList());

        vo.setRosterItems(items);
        return vo;
    }
}
