package com.scriptkill.controller;

import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.review.RadarChartData;
import com.scriptkill.dto.review.ReviewCreateRequest;
import com.scriptkill.dto.review.ReviewResponse;
import com.scriptkill.service.AuthService;
import com.scriptkill.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@Tag(name = "player", description = "复盘评分、雷达图")
public class ReviewController {

    private final ReviewService reviewService;
    private final AuthService authService;

    public ReviewController(ReviewService reviewService, AuthService authService) {
        this.reviewService = reviewService;
        this.authService = authService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PLAYER', 'DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "提交评价", description = "玩家提交复盘评价，支持匿名")
    public ApiResponse<ReviewResponse> createReview(
            @Valid @RequestBody ReviewCreateRequest request) {
        Long playerId = authService.getCurrentUser().getId();
        ReviewResponse response = reviewService.createReview(request, playerId);
        return ApiResponse.success("评价提交成功", response);
    }

    @GetMapping("/session/{sessionId}")
    @Operation(summary = "获取场次评价列表", description = "查看某场次的所有玩家评价")
    public ApiResponse<List<ReviewResponse>> getSessionReviews(
            @Parameter(description = "会话ID") @PathVariable Long sessionId) {
        List<ReviewResponse> reviews = reviewService.getSessionReviews(sessionId);
        return ApiResponse.success(reviews);
    }

    @GetMapping("/script/{scriptId}")
    @Operation(summary = "获取剧本评价列表", description = "分页查看某剧本的所有评价")
    public ApiResponse<Page<ReviewResponse>> getScriptReviews(
            @Parameter(description = "剧本ID") @PathVariable Long scriptId,
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "10") int size) {
        Page<ReviewResponse> reviews = reviewService.getScriptReviews(scriptId, page, size);
        return ApiResponse.success(reviews);
    }

    @GetMapping("/player/{playerId}")
    @Operation(summary = "获取玩家的评价", description = "查看某玩家的所有评价")
    public ApiResponse<List<ReviewResponse>> getPlayerReviews(
            @Parameter(description = "玩家ID") @PathVariable Long playerId) {
        List<ReviewResponse> reviews = reviewService.getPlayerReviews(playerId);
        return ApiResponse.success(reviews);
    }

    @GetMapping("/script/{scriptId}/radar")
    @Operation(summary = "获取剧本雷达图数据", description = "生成剧本的多维评分雷达图数据")
    public ApiResponse<RadarChartData> getScriptRadarChart(
            @Parameter(description = "剧本ID") @PathVariable Long scriptId) {
        RadarChartData data = reviewService.getScriptRadarChart(scriptId);
        return ApiResponse.success(data);
    }

    @GetMapping("/dm/{dmId}/radar")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "获取DM雷达图数据", description = "生成DM的专业度评分雷达图数据")
    public ApiResponse<RadarChartData> getDmRadarChart(
            @Parameter(description = "DM用户ID") @PathVariable Long dmId) {
        RadarChartData data = reviewService.getDmRadarChart(dmId);
        return ApiResponse.success(data);
    }
}
