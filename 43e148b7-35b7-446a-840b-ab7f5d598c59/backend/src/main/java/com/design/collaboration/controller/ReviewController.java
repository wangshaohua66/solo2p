package com.design.collaboration.controller;

import com.design.collaboration.common.ApiResponse;
import com.design.collaboration.dto.ReviewCommentRequest;
import com.design.collaboration.entity.ReviewComment;
import com.design.collaboration.entity.ReviewRecord;
import com.design.collaboration.enums.ReviewLevel;
import com.design.collaboration.enums.ReviewStatus;
import com.design.collaboration.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/review")
@Tag(name = "校审管理", description = "校审记录、意见添加与回复、校审通过/驳回")
public class ReviewController {

    @Autowired
    private ReviewService reviewService;

    @GetMapping("/{id}")
    @Operation(summary = "获取校审记录详情（含意见）")
    public ApiResponse<ReviewRecord> getById(@Parameter(description = "校审记录ID") @PathVariable Long id) {
        ReviewRecord record = reviewService.findById(id);
        if (record == null) {
            return ApiResponse.error("校审记录不存在");
        }
        return ApiResponse.success(record);
    }

    @GetMapping("/list")
    @Operation(summary = "校审记录列表查询")
    public ApiResponse<List<ReviewRecord>> list(
            @Parameter(description = "项目ID") @RequestParam(required = false) Long projectId,
            @Parameter(description = "任务ID") @RequestParam(required = false) Long taskId,
            @Parameter(description = "状态") @RequestParam(required = false) ReviewStatus status,
            @Parameter(description = "校审人ID") @RequestParam(required = false) Long reviewerId) {
        return ApiResponse.success(reviewService.findByConditions(projectId, taskId, status, reviewerId));
    }

    @PostMapping
    @Operation(summary = "发起校审")
    public ApiResponse<ReviewRecord> create(
            @Parameter(description = "任务ID") @RequestParam Long taskId,
            @Parameter(description = "项目ID") @RequestParam Long projectId,
            @Parameter(description = "版本ID") @RequestParam(required = false) Long versionId,
            @Parameter(description = "校审级别") @RequestParam ReviewLevel level,
            HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("发起成功", reviewService.create(taskId, projectId, versionId, level, userId));
    }

    @PostMapping("/comment")
    @Operation(summary = "添加校审意见")
    public ApiResponse<ReviewComment> addComment(@Valid @RequestBody ReviewCommentRequest request, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("添加成功", reviewService.addComment(request, userId));
    }

    @PutMapping("/comment/{id}/reply")
    @Operation(summary = "回复/解决校审意见")
    public ApiResponse<ReviewComment> replyComment(
            @Parameter(description = "意见ID") @PathVariable Long id,
            @Parameter(description = "回复内容") @RequestParam String reply,
            @Parameter(description = "是否解决") @RequestParam(defaultValue = "false") boolean resolved,
            HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("回复成功", reviewService.replyComment(id, reply, resolved, userId));
    }

    @PostMapping("/{id}/pass")
    @Operation(summary = "校审通过")
    public ApiResponse<ReviewRecord> pass(@Parameter(description = "校审记录ID") @PathVariable Long id) {
        return ApiResponse.success("校审通过", reviewService.completeReview(id, true));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "校审驳回")
    public ApiResponse<ReviewRecord> reject(@Parameter(description = "校审记录ID") @PathVariable Long id) {
        return ApiResponse.success("校审驳回", reviewService.completeReview(id, false));
    }
}
