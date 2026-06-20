package com.sportsevent.controller;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.entity.League;
import com.sportsevent.entity.Match;
import com.sportsevent.entity.Referee;
import com.sportsevent.entity.Team;
import com.sportsevent.exception.BusinessException;
import com.sportsevent.exception.ResourceNotFoundException;
import com.sportsevent.repository.LeagueRepository;
import com.sportsevent.repository.MatchRepository;
import com.sportsevent.repository.RefereeRepository;
import com.sportsevent.repository.TeamRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/referees")
@RequiredArgsConstructor
@Tag(name = "裁判管理", description = "裁判管理与指派接口，含回避关系校验")
public class RefereeController {

    private final RefereeRepository refereeRepository;
    private final MatchRepository matchRepository;
    private final LeagueRepository leagueRepository;
    private final TeamRepository teamRepository;

    @PostMapping
    @Operation(summary = "创建裁判信息")
    public ApiResponse<Referee> createReferee(@Valid @RequestBody Referee referee) {
        referee.setStatus(Referee.RefereeStatus.ACTIVE);
        referee.setTotalMatchesAssigned(0);
        referee.setCreatedAt(LocalDateTime.now());
        referee.setUpdatedAt(LocalDateTime.now());
        Referee saved = refereeRepository.save(referee);
        return ApiResponse.success("Referee created", saved);
    }

    @GetMapping
    @Operation(summary = "查询裁判列表")
    public ApiResponse<List<Referee>> listReferees(
            @Parameter(description = "运动类型") @RequestParam(required = false) League.SportType sportType,
            @Parameter(description = "状态") @RequestParam(required = false) Referee.RefereeStatus status) {
        List<Referee> referees;
        if (status != null) {
            referees = refereeRepository.findByStatus(status);
        } else if (sportType != null) {
            referees = refereeRepository.findActiveBySport(sportType);
        } else {
            referees = refereeRepository.findAll();
        }
        return ApiResponse.success(referees);
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询裁判详情")
    public ApiResponse<Referee> getReferee(@PathVariable String id) {
        Referee referee = refereeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Referee", id));
        return ApiResponse.success(referee);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新裁判信息")
    public ApiResponse<Referee> updateReferee(@PathVariable String id, @Valid @RequestBody Referee referee) {
        Referee existing = refereeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Referee", id));
        referee.setId(existing.getId());
        referee.setCreatedAt(existing.getCreatedAt());
        referee.setUpdatedAt(LocalDateTime.now());
        Referee saved = refereeRepository.save(referee);
        return ApiResponse.success("Referee updated", saved);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除裁判")
    public ApiResponse<Void> deleteReferee(@PathVariable String id) {
        if (!refereeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Referee", id);
        }
        refereeRepository.deleteById(id);
        return ApiResponse.success("Referee deleted", null);
    }

    @PostMapping("/{id}/avoidance")
    @Operation(summary = "添加回避关系")
    public ApiResponse<Referee> addAvoidanceRelation(
            @PathVariable String id,
            @RequestBody Referee.AvoidanceRelation relation) {
        Referee referee = refereeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Referee", id));

        if (referee.getAvoidanceRelations() == null) {
            referee.setAvoidanceRelations(new ArrayList<>());
        }

        referee.getAvoidanceRelations().add(relation);
        referee.setUpdatedAt(LocalDateTime.now());
        Referee saved = refereeRepository.save(referee);
        return ApiResponse.success("Avoidance relation added", saved);
    }

    @PostMapping("/assign/recommend")
    @Operation(summary = "智能推荐裁判",
            description = "根据执裁资质、回避关系、执裁负荷均衡自动推荐裁判名单")
    public ApiResponse<List<Referee>> recommendReferees(
            @Parameter(description = "比赛ID") @RequestParam String matchId,
            @Parameter(description = "需要裁判数量") @RequestParam(defaultValue = "3") int count) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match", matchId));

        String leagueId = match.getLeagueId();
        List<Match> leagueMatches = matchRepository.findByLeagueId(leagueId);

        Map<String, Integer> refereeLoad = new HashMap<>();
        for (Match m : leagueMatches) {
            if (m.getRefereeIds() != null) {
                for (String rid : m.getRefereeIds()) {
                    refereeLoad.merge(rid, 1, Integer::sum);
                }
            }
        }

        League.SportType sportType = inferSportType(leagueId);
        List<Referee> allReferees = sportType != null
                ? refereeRepository.findActiveBySport(sportType)
                : refereeRepository.findByStatus(Referee.RefereeStatus.ACTIVE);

        Set<String> avoidedRefereeIds = getAvoidedRefereeIds(match);

        List<Referee> candidates = allReferees.stream()
                .filter(r -> !avoidedRefereeIds.contains(r.getId()))
                .filter(r -> refereeLoad.getOrDefault(r.getId(), 0) < 20)
                .sorted(Comparator.comparingInt((Referee r) -> refereeLoad.getOrDefault(r.getId(), 0))
                        .thenComparing(r -> r.getLevel() != null ? r.getLevel().ordinal() : 99))
                .limit(count)
                .collect(Collectors.toList());

        if (candidates.size() < count) {
            throw new BusinessException("Not enough eligible referees available. Found "
                    + candidates.size() + ", need " + count);
        }

        return ApiResponse.success("Recommended " + candidates.size() + " referees", candidates);
    }

    @PostMapping("/assign/validate")
    @Operation(summary = "校验裁判指派回避关系",
            description = "检查是否存在同单位、亲属关系等回避冲突")
    public ApiResponse<List<AvoidanceWarning>> validateRefereeAssignment(
            @Parameter(description = "比赛ID") @RequestParam String matchId,
            @Parameter(description = "裁判ID列表") @RequestBody List<String> refereeIds) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match", matchId));

        List<AvoidanceWarning> warnings = new ArrayList<>();
        List<Referee> referees = refereeRepository.findByIdIn(refereeIds);
        Map<String, Referee> refereeMap = referees.stream()
                .collect(Collectors.toMap(Referee::getId, r -> r));

        for (String refereeId : refereeIds) {
            Referee referee = refereeMap.get(refereeId);
            if (referee == null) continue;

            if (referee.getAvoidanceRelations() != null) {
                for (Referee.AvoidanceRelation ar : referee.getAvoidanceRelations()) {
                    boolean conflict = false;
                    if (match.getTeamAId() != null && match.getTeamAId().equals(ar.getRelatedEntityId())) {
                        conflict = true;
                    }
                    if (match.getTeamBId() != null && match.getTeamBId().equals(ar.getRelatedEntityId())) {
                        conflict = true;
                    }
                    if (conflict) {
                        AvoidanceWarning w = new AvoidanceWarning();
                        w.setRefereeId(refereeId);
                        w.setRefereeName(referee.getName());
                        w.setAvoidanceType(ar.getType());
                        w.setRelatedEntityId(ar.getRelatedEntityId());
                        w.setRelatedEntityName(ar.getRelatedEntityName());
                        warnings.add(w);
                    }
                }
            }

            List<Match> conflicts = matchRepository.findRefereeConflictingMatches(
                    refereeId, match.getStartTime(), match.getEndTime());
            conflicts.stream()
                    .filter(m -> !m.getId().equals(matchId))
                    .forEach(m -> {
                        AvoidanceWarning w = new AvoidanceWarning();
                        w.setRefereeId(refereeId);
                        w.setRefereeName(referee.getName());
                        w.setAvoidanceType(null);
                        w.setRelatedEntityId(m.getId());
                        w.setRelatedEntityName("Schedule conflict with match: " + m.getId());
                        warnings.add(w);
                    });
        }

        return ApiResponse.success(warnings.isEmpty() ? "No avoidance conflicts"
                : "Found " + warnings.size() + " warnings", warnings);
    }

    @PutMapping("/matches/{matchId}/referees")
    @Operation(summary = "指派裁判到比赛")
    public ApiResponse<Match> assignRefereesToMatch(
            @PathVariable String matchId,
            @RequestBody List<String> refereeIds) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match", matchId));

        List<AvoidanceWarning> warnings = new ArrayList<>();
        ApiResponse<List<AvoidanceWarning>> validationResult = validateRefereeAssignment(matchId, refereeIds);

        if (validationResult.getData() != null && !validationResult.getData().isEmpty()) {
            throw new BusinessException("Referee assignment has avoidance conflicts");
        }

        match.setRefereeIds(refereeIds);
        match.setUpdatedAt(LocalDateTime.now());
        Match saved = matchRepository.save(match);

        for (String refereeId : refereeIds) {
            refereeRepository.findById(refereeId).ifPresent(r -> {
                r.setTotalMatchesAssigned(r.getTotalMatchesAssigned() + 1);
                r.setUpdatedAt(LocalDateTime.now());
                refereeRepository.save(r);
            });
        }

        return ApiResponse.success("Referees assigned", saved);
    }

    private League.SportType inferSportType(String leagueId) {
        return leagueRepository.findById(leagueId)
                .map(League::getSportType)
                .orElse(null);
    }

    private Set<String> getAvoidedRefereeIds(Match match) {
        Set<String> avoided = new HashSet<>();

        Set<String> relatedTeamIds = new HashSet<>();
        if (match.getTeamAId() != null) relatedTeamIds.add(match.getTeamAId());
        if (match.getTeamBId() != null) relatedTeamIds.add(match.getTeamBId());

        Set<String> relatedOrgIds = new HashSet<>();
        for (String teamId : relatedTeamIds) {
            teamRepository.findById(teamId).ifPresent(team -> {
                if (team.getLeaderName() != null) {
                    relatedOrgIds.add(team.getLeaderName());
                }
            });
        }

        List<Referee> allReferees = refereeRepository.findAll();
        for (Referee referee : allReferees) {
            if (referee.getAvoidanceRelations() != null) {
                for (Referee.AvoidanceRelation ar : referee.getAvoidanceRelations()) {
                    if (relatedTeamIds.contains(ar.getRelatedEntityId())) {
                        avoided.add(referee.getId());
                        break;
                    }
                    if (ar.getRelatedEntityName() != null && relatedOrgIds.contains(ar.getRelatedEntityName())) {
                        avoided.add(referee.getId());
                        break;
                    }
                    if (ar.getType() == Referee.AvoidanceRelation.AvoidanceType.SAME_ORGANIZATION
                            && referee.getOrganization() != null
                            && relatedOrgIds.contains(referee.getOrganization())) {
                        avoided.add(referee.getId());
                        break;
                    }
                }
            }
        }

        return avoided;
    }

    @lombok.Data
    public static class AvoidanceWarning {
        private String refereeId;
        private String refereeName;
        private Referee.AvoidanceRelation.AvoidanceType avoidanceType;
        private String relatedEntityId;
        private String relatedEntityName;
    }
}
