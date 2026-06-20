package com.sportsevent.controller;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.engine.LeagueScheduler;
import com.sportsevent.entity.League;
import com.sportsevent.entity.Match;
import com.sportsevent.exception.BusinessException;
import com.sportsevent.exception.ResourceNotFoundException;
import com.sportsevent.repository.LeagueRepository;
import com.sportsevent.repository.MatchRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/leagues")
@RequiredArgsConstructor
@Tag(name = "联赛管理", description = "联赛与赛程管理接口，含赛程自动编排与冲突检测")
public class LeagueController {

    private final LeagueRepository leagueRepository;
    private final MatchRepository matchRepository;
    private final LeagueScheduler leagueScheduler;

    @PostMapping
    @Operation(summary = "创建联赛")
    public ApiResponse<League> createLeague(@Valid @RequestBody League league) {
        league.setCreatedAt(LocalDateTime.now());
        league.setUpdatedAt(LocalDateTime.now());
        league.setStatus(League.LeagueStatus.DRAFT);
        League saved = leagueRepository.save(league);
        return ApiResponse.success("League created", saved);
    }

    @GetMapping
    @Operation(summary = "查询联赛列表")
    public ApiResponse<List<League>> listLeagues(
            @Parameter(description = "赛季年份") @RequestParam(required = false) Integer year,
            @Parameter(description = "运动类型") @RequestParam(required = false) League.SportType sportType,
            @Parameter(description = "联赛状态") @RequestParam(required = false) League.LeagueStatus status) {
        List<League> leagues;
        if (year != null) {
            leagues = leagueRepository.findByYear(year);
        } else if (sportType != null) {
            leagues = leagueRepository.findBySportType(sportType);
        } else if (status != null) {
            leagues = leagueRepository.findByStatus(status);
        } else {
            leagues = leagueRepository.findAll();
        }
        return ApiResponse.success(leagues);
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询联赛详情")
    public ApiResponse<League> getLeague(@PathVariable String id) {
        League league = leagueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("League", id));
        return ApiResponse.success(league);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新联赛信息")
    public ApiResponse<League> updateLeague(@PathVariable String id, @Valid @RequestBody League league) {
        League existing = leagueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("League", id));
        league.setId(existing.getId());
        league.setCreatedAt(existing.getCreatedAt());
        league.setUpdatedAt(LocalDateTime.now());
        League saved = leagueRepository.save(league);
        return ApiResponse.success("League updated", saved);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除联赛")
    public ApiResponse<Void> deleteLeague(@PathVariable String id) {
        if (!leagueRepository.existsById(id)) {
            throw new ResourceNotFoundException("League", id);
        }
        leagueRepository.deleteById(id);
        return ApiResponse.success("League deleted", null);
    }

    @PostMapping("/{leagueId}/schedule/generate")
    @Operation(summary = "自动生成赛程", description = "基于约束满足问题求解场地时段与队伍对阵")
    public ApiResponse<LeagueScheduler.ScheduleResult> generateSchedule(@PathVariable String leagueId) {
        League league = leagueRepository.findById(leagueId)
                .orElseThrow(() -> new ResourceNotFoundException("League", leagueId));

        if (league.getPhase() == League.SeasonPhase.KNOCKOUT_STAGE
                || league.getPhase() == League.SeasonPhase.FINISHED) {
            throw new BusinessException("Cannot generate schedule for league in phase: " + league.getPhase());
        }

        LeagueScheduler.ScheduleResult result = leagueScheduler.generateSchedule(leagueId);

        if (result.isSuccess() && result.getMatches() != null) {
            List<Match> saved = matchRepository.saveAll(result.getMatches());
            result.setMatches(saved);
        }

        return ApiResponse.success(result.getMessage(), result);
    }

    @GetMapping("/{leagueId}/matches")
    @Operation(summary = "查询联赛赛程列表")
    public ApiResponse<List<Match>> listLeagueMatches(
            @PathVariable String leagueId,
            @Parameter(description = "分组名称") @RequestParam(required = false) String groupName,
            @Parameter(description = "比赛阶段") @RequestParam(required = false) Match.StageType stage) {
        List<Match> matches;
        if (groupName != null) {
            matches = matchRepository.findByLeagueIdAndGroupName(leagueId, groupName);
        } else if (stage != null) {
            matches = matchRepository.findByLeagueIdAndStage(leagueId, stage);
        } else {
            matches = matchRepository.findByLeagueId(leagueId);
        }
        return ApiResponse.success(matches);
    }

    @PutMapping("/{leagueId}/matches/{matchId}")
    @Operation(summary = "调整单场比赛", description = "手动微调比赛时间、场地后自动重新校验冲突，冲突时保存并标记警告")
    public ApiResponse<Match> updateMatch(
            @PathVariable String leagueId,
            @PathVariable String matchId,
            @RequestBody Match match,
            @Parameter(description = "是否强制保存（有冲突时）") @RequestParam(defaultValue = "false") boolean forceSave) {
        Match existing = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match", matchId));

        if (!existing.getLeagueId().equals(leagueId)) {
            throw new BusinessException("Match does not belong to this league");
        }

        match.setId(existing.getId());
        match.setLeagueId(leagueId);
        match.setUpdatedAt(LocalDateTime.now());

        List<Match.ConflictWarning> conflicts = leagueScheduler.validateMatchConflicts(match);
        match.setConflicts(conflicts);

        boolean hasCriticalConflict = conflicts.stream().anyMatch(c ->
                c.getType() == Match.ConflictWarning.ConflictType.VENUE_CONFLICT
                        || c.getType() == Match.ConflictWarning.ConflictType.TEAM_CONFLICT
                        || c.getType() == Match.ConflictWarning.ConflictType.REFEREE_CONFLICT
                        || c.getType() == Match.ConflictWarning.ConflictType.ATHLETE_MULTISPORT_CONFLICT);

        if (hasCriticalConflict && !forceSave) {
            return ApiResponse.warning("Match has " + conflicts.size() + " conflict warnings. Set forceSave=true to save anyway.", match);
        }

        Match saved = matchRepository.save(match);
        String message = conflicts.isEmpty() ? "Match updated (validated)"
                : "Match saved with " + conflicts.size() + " conflict warnings";
        return ApiResponse.success(message, saved);
    }

    @PostMapping("/{leagueId}/matches/{matchId}/validate")
    @Operation(summary = "校验比赛冲突")
    public ApiResponse<List<Match.ConflictWarning>> validateMatch(
            @PathVariable String leagueId,
            @PathVariable String matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match", matchId));
        List<Match.ConflictWarning> conflicts = leagueScheduler.validateMatchConflicts(match);
        return ApiResponse.success(conflicts);
    }
}
