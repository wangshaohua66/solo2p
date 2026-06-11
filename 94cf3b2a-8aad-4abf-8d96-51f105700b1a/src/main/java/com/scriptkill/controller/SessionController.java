package com.scriptkill.controller;

import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.common.PageResult;
import com.scriptkill.dto.matching.MatchingPlan;
import com.scriptkill.dto.session.SessionCreateRequest;
import com.scriptkill.dto.session.SessionEventResponse;
import com.scriptkill.dto.session.SessionResponse;
import com.scriptkill.service.AuthService;
import com.scriptkill.service.MatchingService;
import com.scriptkill.service.SessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/session")
@Tag(name = "session", description = "开本会话、状态机、事件溯源")
public class SessionController {

    private final SessionService sessionService;
    private final MatchingService matchingService;
    private final AuthService authService;

    public SessionController(SessionService sessionService,
                             MatchingService matchingService,
                             AuthService authService) {
        this.sessionService = sessionService;
        this.matchingService = matchingService;
        this.authService = authService;
    }

    @GetMapping
    @Operation(summary = "分页查询会话列表", description = "支持按状态筛选")
    public ApiResponse<PageResult<SessionResponse>> listSessions(
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "会话状态") @RequestParam(required = false) String status) {
        PageResult<SessionResponse> result = sessionService.listSessions(page, size, status);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取会话详情")
    public ApiResponse<SessionResponse> getSessionDetail(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        SessionResponse response = sessionService.getSessionDetail(id);
        return ApiResponse.success(response);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "创建开本会话", description = "DM或管理员创建新的开本场次")
    public ApiResponse<SessionResponse> createSession(
            @Valid @RequestBody SessionCreateRequest request) {
        SessionResponse response = sessionService.createSession(request);
        return ApiResponse.success("会话创建成功", response);
    }

    @PostMapping("/{id}/start-matching")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "开始拼场", description = "将会话状态切换为拼场中")
    public ApiResponse<SessionResponse> startMatching(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        Long userId = authService.getCurrentUser().getId();
        SessionResponse response = sessionService.startMatching(id, userId);
        return ApiResponse.success("开始拼场", response);
    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "确认开本", description = "确认人数足够，切换为首发确认状态")
    public ApiResponse<SessionResponse> confirmSession(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        Long userId = authService.getCurrentUser().getId();
        SessionResponse response = sessionService.confirmSession(id, userId);
        return ApiResponse.success("开本确认成功", response);
    }

    @PostMapping("/{id}/start-playing")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "开始游戏", description = "游戏正式开始，切换为游戏中状态")
    public ApiResponse<SessionResponse> startPlaying(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        Long userId = authService.getCurrentUser().getId();
        SessionResponse response = sessionService.startPlaying(id, userId);
        return ApiResponse.success("游戏开始", response);
    }

    @PostMapping("/{id}/start-reviewing")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "开始复盘", description = "切换为复盘中状态")
    public ApiResponse<SessionResponse> startReviewing(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        Long userId = authService.getCurrentUser().getId();
        SessionResponse response = sessionService.startReviewing(id, userId);
        return ApiResponse.success("开始复盘", response);
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "完成会话", description = "会话结束，切换为完成状态")
    public ApiResponse<SessionResponse> completeSession(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        Long userId = authService.getCurrentUser().getId();
        SessionResponse response = sessionService.completeSession(id, userId);
        return ApiResponse.success("会话完成", response);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "取消会话", description = "取消开本会话")
    public ApiResponse<SessionResponse> cancelSession(
            @Parameter(description = "会话ID") @PathVariable Long id,
            @Parameter(description = "取消原因") @RequestParam(required = false) String reason) {
        Long userId = authService.getCurrentUser().getId();
        SessionResponse response = sessionService.cancelSession(id, userId, reason);
        return ApiResponse.success("会话已取消", response);
    }

    @PostMapping("/{id}/next-stage")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "进入下一阶段", description = "推进到下一个剧本阶段")
    public ApiResponse<SessionResponse> nextStage(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        Long userId = authService.getCurrentUser().getId();
        SessionResponse response = sessionService.nextStage(id, userId);
        return ApiResponse.success("已进入下一阶段", response);
    }

    @GetMapping("/{id}/events")
    @Operation(summary = "获取事件溯源日志", description = "查看会话所有状态变更事件")
    public ApiResponse<List<SessionEventResponse>> getSessionEvents(
            @Parameter(description = "会话ID") @PathVariable Long id) {
        List<SessionEventResponse> events = sessionService.getSessionEvents(id);
        return ApiResponse.success(events);
    }

    @PostMapping("/{id}/matching/top3")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "生成TOP3拼场方案", description = "基于玩家偏好匹配生成最优拼场方案")
    public ApiResponse<List<MatchingPlan>> generateTop3MatchingPlans(
            @Parameter(description = "会话ID") @PathVariable Long id,
            @Parameter(description = "候选玩家ID列表") @RequestBody List<Long> candidatePlayerIds) {
        List<MatchingPlan> plans = matchingService.generateTop3Plans(id, candidatePlayerIds);
        return ApiResponse.success("匹配完成", plans);
    }
}
