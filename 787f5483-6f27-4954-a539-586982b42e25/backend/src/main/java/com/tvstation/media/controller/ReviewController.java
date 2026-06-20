package com.tvstation.media.controller;

import com.tvstation.media.common.ApiResponse;
import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.ReviewItem;
import com.tvstation.media.entity.ReviewRecord;
import com.tvstation.media.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
@Tag(name = "审核管理", description = "三级审核流程相关接口")
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping
    @Operation(summary = "获取审核列表")
    public ApiResponse<PageResult<ReviewItem>> getReviews(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) ReviewItem.ReviewStatus status,
            @RequestParam(required = false) ReviewItem.ReviewType type,
            @RequestParam(required = false) Integer currentLevel) {

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "submittedAt"));
        PageResult<ReviewItem> result = reviewService.getReviews(status, type, currentLevel, pageable);
        return ApiResponse.success(result, result.getTotal());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取审核详情")
    public ApiResponse<ReviewItem> getReviewDetail(@PathVariable Long id) {
        return ApiResponse.success(reviewService.getReviewById(id));
    }

    @PostMapping("/{id}")
    @Operation(summary = "提交审核")
    public ApiResponse<ReviewRecord> submitReview(
            @PathVariable Long id,
            @RequestBody Map<String, Object> reviewData,
            @RequestHeader("userId") Long userId,
            @RequestHeader("userName") String userName) {

        Integer level = (Integer) reviewData.get("level");
        String status = (String) reviewData.get("status");
        String comment = (String) reviewData.get("comment");
        String version = (String) reviewData.get("version");

        ReviewRecord record = reviewService.submitReview(id, level, status, comment, version, userId, userName);
        return ApiResponse.success("审核提交成功", record);
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "获取审核历史")
    public ApiResponse<List<ReviewRecord>> getReviewHistory(@PathVariable Long id) {
        return ApiResponse.success(reviewService.getReviewHistory(id));
    }

    @GetMapping("/{id}/compare")
    @Operation(summary = "版本对比")
    public ApiResponse<String> compareVersions(
            @PathVariable Long id,
            @RequestParam String version1,
            @RequestParam String version2) {
        String diff = reviewService.compareVersions(id, version1, version2);
        return ApiResponse.success(diff);
    }

    @GetMapping("/my-pending")
    @Operation(summary = "获取待我审核的列表")
    public ApiResponse<List<ReviewItem>> getMyPendingReviews(@RequestHeader("userId") Long userId) {
        return ApiResponse.success(reviewService.getPendingReviewsByUser(userId));
    }

    @PostMapping("/{id}/remind")
    @Operation(summary = "催办审核")
    public ApiResponse<Void> remindReviewer(
            @PathVariable Long id,
            @RequestBody Map<String, Long> data,
            @RequestHeader("userId") Long userId) {

        Long reviewerId = data.get("reviewerId");
        reviewService.remindReviewer(id, reviewerId, userId);
        return ApiResponse.success("提醒已发送", null);
    }

    @PostMapping
    @Operation(summary = "创建审核")
    public ApiResponse<ReviewItem> createReview(
            @RequestBody ReviewItem reviewItem,
            @RequestHeader("userId") Long userId,
            @RequestHeader("userName") String userName) {

        ReviewItem created = reviewService.createReview(reviewItem, userId, userName);
        return ApiResponse.success("审核创建成功", created);
    }

    @GetMapping("/statistics")
    @Operation(summary = "审核统计")
    public ApiResponse<Map<String, Object>> getReviewStatistics() {
        return ApiResponse.success(reviewService.getReviewStatistics());
    }
}
