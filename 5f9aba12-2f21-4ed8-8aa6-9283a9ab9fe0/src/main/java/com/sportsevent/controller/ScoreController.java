package com.sportsevent.controller;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.engine.NotificationDispatcher;
import com.sportsevent.engine.ScoreCalculator;
import com.sportsevent.entity.*;
import com.sportsevent.exception.BusinessException;
import com.sportsevent.exception.ResourceNotFoundException;
import com.sportsevent.repository.KnockoutBracketRepository;
import com.sportsevent.repository.MatchRepository;
import com.sportsevent.repository.RankingRepository;
import com.sportsevent.repository.ScoreRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/scores")
@RequiredArgsConstructor
@Tag(name = "成绩管理", description = "成绩录入与排名计算接口，含小组积分与晋级树生成")
public class ScoreController {

    private final ScoreRepository scoreRepository;
    private final MatchRepository matchRepository;
    private final RankingRepository rankingRepository;
    private final KnockoutBracketRepository knockoutBracketRepository;
    private final ScoreCalculator scoreCalculator;
    private final NotificationDispatcher notificationDispatcher;

    @PostMapping
    @Operation(summary = "录入比赛成绩")
    public ApiResponse<Score> createScore(@Valid @RequestBody Score score) {
        if (score.getMatchId() == null) {
            throw new BusinessException("Match ID is required");
        }

        Match match = matchRepository.findById(score.getMatchId())
                .orElseThrow(() -> new ResourceNotFoundException("Match", score.getMatchId()));

        score.setLeagueId(match.getLeagueId());
        score.setTeamAId(match.getTeamAId());
        score.setTeamBId(match.getTeamBId());
        score.setStatus(Score.ScoreStatus.DRAFT);
        score.setAppealed(false);
        score.setRecordedAt(LocalDateTime.now());
        score.setCreatedAt(LocalDateTime.now());
        score.setUpdatedAt(LocalDateTime.now());

        Score saved = scoreRepository.save(score);
        return ApiResponse.success("Score recorded", saved);
    }

    @GetMapping
    @Operation(summary = "查询成绩列表")
    public ApiResponse<List<Score>> listScores(
            @Parameter(description = "联赛ID") @RequestParam(required = false) String leagueId,
            @Parameter(description = "比赛ID") @RequestParam(required = false) String matchId,
            @Parameter(description = "成绩状态") @RequestParam(required = false) Score.ScoreStatus status) {
        List<Score> scores;
        if (matchId != null) {
            scores = scoreRepository.findByMatchId(matchId).map(List::of).orElse(List.of());
        } else if (leagueId != null && status != null) {
            scores = scoreRepository.findByLeagueIdAndStatus(leagueId, status);
        } else if (leagueId != null) {
            scores = scoreRepository.findByLeagueId(leagueId);
        } else {
            scores = scoreRepository.findAll();
        }
        return ApiResponse.success(scores);
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询成绩详情")
    public ApiResponse<Score> getScore(@PathVariable String id) {
        Score score = scoreRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Score", id));
        return ApiResponse.success(score);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新成绩")
    public ApiResponse<Score> updateScore(@PathVariable String id, @Valid @RequestBody Score score) {
        Score existing = scoreRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Score", id));

        score.setId(existing.getId());
        score.setLeagueId(existing.getLeagueId());
        score.setTeamAId(existing.getTeamAId());
        score.setTeamBId(existing.getTeamBId());
        score.setCreatedAt(existing.getCreatedAt());
        score.setUpdatedAt(LocalDateTime.now());

        Score saved = scoreRepository.save(score);
        return ApiResponse.success("Score updated", saved);
    }

    @PutMapping("/{id}/confirm")
    @Operation(summary = "确认成绩", description = "确认后触发积分计算和级联排名更新")
    public ApiResponse<Score> confirmScore(
            @PathVariable String id,
            @Parameter(description = "录入人") @RequestParam String recordedBy) {
        Score score = scoreRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Score", id));

        score.setStatus(Score.ScoreStatus.CONFIRMED);
        score.setRecordedBy(recordedBy);
        score.setRecordedAt(LocalDateTime.now());
        score.setUpdatedAt(LocalDateTime.now());

        Score saved = scoreRepository.save(score);

        Match match = matchRepository.findById(score.getMatchId()).orElse(null);
        if (match != null) {
            match.setStatus(Match.MatchStatus.FINISHED);
            match.setScoreId(saved.getId());
            match.setUpdatedAt(LocalDateTime.now());
            matchRepository.save(match);
        }

        scoreCalculator.calculateGroupRankings(score.getLeagueId());

        notifyScorePublished(saved);

        return ApiResponse.success("Score confirmed, rankings recalculated", saved);
    }

    @PostMapping("/{id}/appeal")
    @Operation(summary = "提交成绩申诉")
    public ApiResponse<Score> appealScore(
            @PathVariable String id,
            @Parameter(description = "申诉人") @RequestParam String appealedBy,
            @Parameter(description = "申诉理由") @RequestParam String reason) {
        Score score = scoreRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Score", id));

        if (score.getStatus() != Score.ScoreStatus.CONFIRMED) {
            throw new BusinessException("Only confirmed scores can be appealed");
        }

        Score.AppealRecord appeal = new Score.AppealRecord();
        appeal.setReason(reason);
        appeal.setAppealedAt(LocalDateTime.now());
        appeal.setAppealedBy(appealedBy);
        score.setAppealRecord(appeal);
        score.setAppealed(true);
        score.setStatus(Score.ScoreStatus.APPEALED);
        score.setUpdatedAt(LocalDateTime.now());

        Score saved = scoreRepository.save(score);
        return ApiResponse.success("Appeal submitted", saved);
    }

    @PutMapping("/{id}/appeal/decision")
    @Operation(summary = "处理成绩申诉", description = "申诉处理后级联重算积分排名")
    public ApiResponse<Score> resolveAppeal(
            @PathVariable String id,
            @Parameter(description = "处理人") @RequestParam String decidedBy,
            @Parameter(description = "判定结果") @RequestParam Score.AppealRecord.AppealDecision decision,
            @Parameter(description = "处理说明") @RequestParam(required = false) String note) {
        Score score = scoreRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Score", id));

        if (score.getAppealRecord() == null) {
            throw new BusinessException("No appeal record found");
        }

        score.getAppealRecord().setDecision(decision);
        score.getAppealRecord().setDecidedAt(LocalDateTime.now());
        score.getAppealRecord().setDecidedBy(decidedBy);
        score.getAppealRecord().setDecisionNote(note);

        if (decision == Score.AppealRecord.AppealDecision.UPHELD) {
            score.setStatus(Score.ScoreStatus.OVERRULED);
        } else {
            score.setStatus(Score.ScoreStatus.CONFIRMED);
        }
        score.setUpdatedAt(LocalDateTime.now());

        Score saved = scoreRepository.save(score);
        scoreCalculator.calculateGroupRankings(score.getLeagueId());

        return ApiResponse.success("Appeal resolved, rankings recalculated", saved);
    }

    @PostMapping("/{leagueId}/rankings/calculate")
    @Operation(summary = "计算小组积分排名")
    public ApiResponse<ScoreCalculator.CalculationResult> calculateRankings(@PathVariable String leagueId) {
        ScoreCalculator.CalculationResult result = scoreCalculator.calculateGroupRankings(leagueId);
        return ApiResponse.success(result.getMessage(), result);
    }

    @GetMapping("/{leagueId}/rankings")
    @Operation(summary = "查询积分排名")
    public ApiResponse<List<Ranking>> listRankings(
            @PathVariable String leagueId,
            @Parameter(description = "分组名称") @RequestParam(required = false) String groupName) {
        List<Ranking> rankings;
        if (groupName != null) {
            rankings = rankingRepository.findByLeagueIdAndGroupName(leagueId, groupName);
        } else {
            rankings = rankingRepository.findByLeagueId(leagueId);
        }
        return ApiResponse.success(rankings);
    }

    @PostMapping("/{leagueId}/knockout/generate")
    @Operation(summary = "生成淘汰赛对阵树")
    public ApiResponse<ScoreCalculator.KnockoutGenerationResult> generateKnockoutBracket(
            @PathVariable String leagueId) {
        ScoreCalculator.KnockoutGenerationResult result = scoreCalculator.generateKnockoutBracket(leagueId);
        return ApiResponse.success(result.getMessage(), result);
    }

    @GetMapping("/{leagueId}/knockout")
    @Operation(summary = "查询淘汰赛对阵树")
    public ApiResponse<List<KnockoutBracket>> getKnockoutBrackets(@PathVariable String leagueId) {
        List<KnockoutBracket> brackets = knockoutBracketRepository.findByLeagueId(leagueId);
        return ApiResponse.success(brackets);
    }

    private void notifyScorePublished(Score score) {
        List<Notification.Recipient> recipients = new ArrayList<>();
        Notification notification = notificationDispatcher.createNotification(
                Notification.NotificationType.SCORE_PUBLISHED,
                "比赛成绩已公布",
                "比赛结果: " + score.getTeamAScore() + " - " + score.getTeamBScore(),
                score.getId(),
                "Score",
                Notification.NotificationChannel.IN_APP,
                recipients
        );
        notificationDispatcher.dispatch(notification);
    }
}
