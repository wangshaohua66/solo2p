package com.scriptkill.controller;

import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.script.ClueResponse;
import com.scriptkill.service.AuthService;
import com.scriptkill.service.ClueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clues")
@Tag(name = "05-线索引擎", description = "DM线索推送与时间轴回放")
public class ClueController {

    private final ClueService clueService;
    private final AuthService authService;

    public ClueController(ClueService clueService, AuthService authService) {
        this.clueService = clueService;
        this.authService = authService;
    }

    @GetMapping("/session/{sessionId}")
    @Operation(summary = "获取已触发线索", description = "获取当前会话已触发的所有线索")
    public ApiResponse<List<ClueResponse>> getAvailableClues(
            @Parameter(description = "会话ID") @PathVariable Long sessionId) {
        List<ClueResponse> clues = clueService.getAvailableClues(sessionId);
        return ApiResponse.success(clues);
    }

    @GetMapping("/session/{sessionId}/stage")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "获取当前阶段线索", description = "获取当前阶段可用的线索列表")
    public ApiResponse<List<ClueResponse>> getStageClues(
            @Parameter(description = "会话ID") @PathVariable Long sessionId) {
        List<ClueResponse> clues = clueService.getStageClues(sessionId);
        return ApiResponse.success(clues);
    }

    @PostMapping("/session/{sessionId}/trigger/{clueId}")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "DM主动触发线索", description = "DM手动推送线索给玩家")
    public ApiResponse<ClueResponse> triggerClue(
            @Parameter(description = "会话ID") @PathVariable Long sessionId,
            @Parameter(description = "线索ID") @PathVariable Long clueId) {
        Long dmUserId = authService.getCurrentUser().getId();
        ClueResponse clue = clueService.triggerClue(sessionId, clueId, dmUserId, "MANUAL");
        return ApiResponse.success("线索已推送", clue);
    }

    @GetMapping("/session/{sessionId}/time-check")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "检查时间触发线索", description = "根据游戏进行时间检查可触发的时间类线索")
    public ApiResponse<List<ClueResponse>> checkTimeTriggeredClues(
            @Parameter(description = "会话ID") @PathVariable Long sessionId,
            @Parameter(description = "已进行分钟数") @RequestParam int elapsedMinutes) {
        List<ClueResponse> clues = clueService.getTriggerableCluesByTime(sessionId, elapsedMinutes);
        return ApiResponse.success(clues);
    }

    @PostMapping("/session/{sessionId}/event/{eventName}")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "触发事件类线索", description = "触发事件，检查并推送相关线索")
    public ApiResponse<List<ClueResponse>> triggerEventClues(
            @Parameter(description = "会话ID") @PathVariable Long sessionId,
            @Parameter(description = "事件名称") @PathVariable String eventName) {
        Long dmUserId = authService.getCurrentUser().getId();
        List<ClueResponse> clues = clueService.checkEventTrigger(sessionId, eventName, dmUserId);
        return ApiResponse.success("事件触发完成", clues);
    }

    @GetMapping("/session/{sessionId}/timeline")
    @Operation(summary = "获取线索时间轴", description = "复盘支持时间轴回放，按触发顺序展示线索")
    public ApiResponse<List<ClueResponse>> getClueTimeline(
            @Parameter(description = "会话ID") @PathVariable Long sessionId) {
        List<ClueResponse> clues = clueService.getClueTimeline(sessionId);
        return ApiResponse.success(clues);
    }

    @GetMapping("/script/{scriptId}")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "获取剧本所有线索", description = "DM视角查看剧本全部线索")
    public ApiResponse<List<ClueResponse>> getAllScriptClues(
            @Parameter(description = "剧本ID") @PathVariable Long scriptId) {
        List<ClueResponse> clues = clueService.getAllCluesForDm(scriptId);
        return ApiResponse.success(clues);
    }

    @GetMapping("/{clueId}")
    @Operation(summary = "获取线索详情")
    public ApiResponse<ClueResponse> getClueDetail(
            @Parameter(description = "线索ID") @PathVariable Long clueId) {
        ClueResponse clue = clueService.getClueDetail(clueId);
        return ApiResponse.success(clue);
    }
}
