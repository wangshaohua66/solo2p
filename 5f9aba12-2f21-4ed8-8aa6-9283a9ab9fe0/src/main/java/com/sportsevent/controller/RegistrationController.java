package com.sportsevent.controller;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.engine.EligibilityValidator;
import com.sportsevent.engine.LeagueScheduler;
import com.sportsevent.entity.Athlete;
import com.sportsevent.entity.League;
import com.sportsevent.entity.Ranking;
import com.sportsevent.entity.Registration;
import com.sportsevent.entity.Score;
import com.sportsevent.exception.BusinessException;
import com.sportsevent.exception.ResourceNotFoundException;
import com.sportsevent.repository.AthleteRepository;
import com.sportsevent.repository.LeagueRepository;
import com.sportsevent.repository.RankingRepository;
import com.sportsevent.repository.RegistrationRepository;
import com.sportsevent.repository.ScoreRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/registrations")
@RequiredArgsConstructor
@Tag(name = "报名管理", description = "运动员报名与资格审核接口，含兼项冲突检测")
public class RegistrationController {

    private final RegistrationRepository registrationRepository;
    private final AthleteRepository athleteRepository;
    private final EligibilityValidator eligibilityValidator;
    private final LeagueScheduler leagueScheduler;
    private final ScoreRepository scoreRepository;
    private final RankingRepository rankingRepository;
    private final LeagueRepository leagueRepository;

    @PostMapping
    @Operation(summary = "提交报名申请")
    public ApiResponse<Registration> submitRegistration(@Valid @RequestBody Registration registration) {
        registration.setStatus(Registration.RegistrationStatus.SUBMITTED);
        registration.setSubmittedAt(LocalDateTime.now());
        registration.setCreatedAt(LocalDateTime.now());
        registration.setUpdatedAt(LocalDateTime.now());

        Registration saved = registrationRepository.save(registration);

        EligibilityValidator.EligibilityResult result = eligibilityValidator.validateRegistration(saved);
        saved.setEligibilityIssues(result.getIssues());

        if (!result.isValid()) {
            saved.setStatus(Registration.RegistrationStatus.REJECTED);
        }

        saved.setUpdatedAt(LocalDateTime.now());
        saved = registrationRepository.save(saved);

        return ApiResponse.success(result.isValid() ? "Registration submitted and approved"
                : "Registration submitted with eligibility issues", saved);
    }

    @GetMapping
    @Operation(summary = "查询报名列表")
    public ApiResponse<List<Registration>> listRegistrations(
            @Parameter(description = "联赛ID") @RequestParam(required = false) String leagueId,
            @Parameter(description = "审核状态") @RequestParam(required = false) Registration.RegistrationStatus status) {
        List<Registration> registrations;
        if (leagueId != null && status != null) {
            registrations = registrationRepository.findByLeagueIdAndStatus(leagueId, status);
        } else if (leagueId != null) {
            registrations = registrationRepository.findByLeagueId(leagueId);
        } else {
            registrations = registrationRepository.findAll();
        }
        return ApiResponse.success(registrations);
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询报名详情")
    public ApiResponse<Registration> getRegistration(@PathVariable String id) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", id));
        return ApiResponse.success(registration);
    }

    @PostMapping("/{id}/validate")
    @Operation(summary = "执行资格校验", description = "链式校验：年龄组别、注册有效期、禁赛记录、兼项上限")
    public ApiResponse<EligibilityValidator.EligibilityResult> validateEligibility(@PathVariable String id) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", id));

        EligibilityValidator.EligibilityResult result = eligibilityValidator.validateRegistration(registration);

        registration.setEligibilityIssues(result.getIssues());
        registration.setUpdatedAt(LocalDateTime.now());
        registrationRepository.save(registration);

        return ApiResponse.success(result.isValid() ? "All eligibility checks passed"
                : "Found " + result.getErrorsCount() + " errors, " + result.getWarningsCount() + " warnings", result);
    }

    @PutMapping("/{id}/approve")
    @Operation(summary = "审核通过报名")
    public ApiResponse<Registration> approveRegistration(
            @PathVariable String id,
            @Parameter(description = "审核人") @RequestParam String reviewer) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", id));

        EligibilityValidator.EligibilityResult result = eligibilityValidator.validateRegistration(registration);
        if (!result.isValid()) {
            throw new BusinessException("Cannot approve registration with eligibility errors: "
                    + result.getErrorsCount() + " issues");
        }

        registration.setStatus(Registration.RegistrationStatus.APPROVED);
        registration.setReviewedAt(LocalDateTime.now());
        registration.setReviewedBy(reviewer);
        registration.setEligibilityIssues(result.getIssues());
        registration.setUpdatedAt(LocalDateTime.now());

        Registration saved = registrationRepository.save(registration);

        triggerScheduleRecreationAsync(registration.getLeagueId());

        return ApiResponse.success("Registration approved, schedule recreation triggered", saved);
    }

    @Async
    public void triggerScheduleRecreationAsync(String leagueId) {
        try {
            log.info("Triggering schedule recreation for league: {}", leagueId);
            leagueScheduler.generateSchedule(leagueId);
            log.info("Schedule recreation completed for league: {}", leagueId);
        } catch (Exception e) {
            log.error("Failed to recreate schedule for league: {}", leagueId, e);
        }
    }

    @PutMapping("/{id}/reject")
    @Operation(summary = "驳回报名")
    public ApiResponse<Registration> rejectRegistration(
            @PathVariable String id,
            @Parameter(description = "审核人") @RequestParam String reviewer,
            @Parameter(description = "驳回原因") @RequestParam(required = false) String reason) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", id));

        registration.setStatus(Registration.RegistrationStatus.REJECTED);
        registration.setReviewedAt(LocalDateTime.now());
        registration.setReviewedBy(reviewer);
        registration.setUpdatedAt(LocalDateTime.now());

        Registration saved = registrationRepository.save(registration);
        return ApiResponse.success("Registration rejected", saved);
    }

    @GetMapping("/athletes/{athleteId}/conflicts")
    @Operation(summary = "检测运动员兼项冲突", description = "检测运动员是否存在跨项目兼项的赛程冲突")
    public ApiResponse<List<Registration.MultiSportConflict>> detectMultiSportConflicts(
            @PathVariable String athleteId,
            @Parameter(description = "候选开始时间") @RequestParam String startTime,
            @Parameter(description = "候选结束时间") @RequestParam String endTime) {
        Athlete athlete = athleteRepository.findById(athleteId)
                .orElseThrow(() -> new ResourceNotFoundException("Athlete", athleteId));

        List<Registration.MultiSportConflict> conflicts = eligibilityValidator.detectMultiSportConflicts(
                athleteId, LocalDateTime.parse(startTime), LocalDateTime.parse(endTime));

        return ApiResponse.success(conflicts);
    }

    @GetMapping("/athletes/{athleteId}/profile")
    @Operation(summary = "查询运动员参赛档案", description = "聚合跨赛季跨项目参赛记录、成绩排名、禁赛历史")
    public ApiResponse<AthleteProfileDTO> getAthleteProfile(@PathVariable String athleteId) {
        Athlete athlete = athleteRepository.findById(athleteId)
                .orElseThrow(() -> new ResourceNotFoundException("Athlete", athleteId));

        List<Registration> registrations = registrationRepository.findByAthleteId(athleteId);
        List<Score> scores = scoreRepository.findByAthleteId(athleteId);
        List<Ranking> rankings = rankingRepository.findByAthleteId(athleteId);

        AthleteProfileDTO profile = new AthleteProfileDTO();
        profile.setAthleteId(athleteId);
        profile.setName(athlete.getName());
        profile.setGender(athlete.getGender());
        profile.setBirthDate(athlete.getBirthDate());
        profile.setOrganization(athlete.getOrganization());
        profile.setStatus(athlete.getStatus());
        profile.setRegistrationCount((long) registrations.size());
        java.util.Set<String> leagueIds = registrations.stream()
                .map(Registration::getLeagueId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        java.util.Set<League.SportType> participatedSports = new java.util.HashSet<>();
        for (String leagueId : leagueIds) {
            leagueRepository.findById(leagueId).ifPresent(l -> {
                if (l.getSportType() != null) {
                    participatedSports.add(l.getSportType());
                }
            });
        }
        profile.setParticipatedSports(participatedSports);
        profile.setScores(scores);
        profile.setRankings(rankings);
        profile.setSuspensionRecords(athlete.getSuspensionRecords());

        long totalWins = scores.stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsWin()))
                .count();
        profile.setTotalWins(totalWins);
        profile.setTotalMatches((long) scores.size());

        double winRate = scores.isEmpty() ? 0.0 : (double) totalWins / scores.size() * 100;
        profile.setWinRate(winRate);

        return ApiResponse.success(profile);
    }

    @GetMapping("/athletes/{athleteId}/profile/export")
    @Operation(summary = "导出运动员档案统计", description = "导出运动员参赛记录与成绩统计")
    public ApiResponse<AthleteProfileDTO> exportAthleteProfile(@PathVariable String athleteId) {
        return getAthleteProfile(athleteId);
    }

    @lombok.Data
    public static class AthleteProfileDTO {
        private String athleteId;
        private String name;
        private String gender;
        private LocalDateTime birthDate;
        private String organization;
        private Athlete.AthleteStatus status;
        private Long registrationCount;
        private java.util.Set<com.sportsevent.entity.League.SportType> participatedSports;
        private List<Score> scores;
        private List<Ranking> rankings;
        private java.util.List<Athlete.SuspensionRecord> suspensionRecords;
        private Long totalWins;
        private Long totalMatches;
        private Double winRate;
    }

    @GetMapping("/athletes")
    @Operation(summary = "查询运动员列表")
    public ApiResponse<List<Athlete>> listAthletes(
            @Parameter(description = "组织单位") @RequestParam(required = false) String organization,
            @Parameter(description = "状态") @RequestParam(required = false) Athlete.AthleteStatus status) {
        List<Athlete> athletes;
        if (organization != null) {
            athletes = athleteRepository.findByOrganization(organization);
        } else {
            athletes = athleteRepository.findAll();
        }
        return ApiResponse.success(athletes);
    }
}
