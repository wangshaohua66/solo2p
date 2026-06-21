package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.entity.ApprovalTask;
import com.court.execution.service.ApprovalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/approvals")
@Tag(name = "审批管理", description = "审批任务查询、审批处理等接口")
public class ApprovalController {

    private final ApprovalService approvalService;

    public ApprovalController(ApprovalService approvalService) {
        this.approvalService = approvalService;
    }

    @GetMapping("/my-tasks")
    @Operation(summary = "获取我的待办审批", description = "获取当前登录用户作为审批人的待办审批任务")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<List<ApprovalTask>> getMyPendingTasks() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        List<ApprovalTask> tasks = approvalService.getPendingTasksByApproverUsername(username);
        return ApiResponse.success(tasks);
    }

    @GetMapping("/my-applications")
    @Operation(summary = "获取我的申请记录", description = "获取当前登录用户发起的所有审批任务")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<ApprovalTask>> getMyApplications() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        List<ApprovalTask> tasks = approvalService.getTasksByApplicantUsername(username);
        return ApiResponse.success(tasks);
    }

    @GetMapping("/{taskId}")
    @Operation(summary = "获取审批详情", description = "根据审批任务ID获取审批详情")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ApprovalTask> getTaskById(@PathVariable Long taskId) {
        ApprovalTask task = approvalService.getTaskById(taskId);
        return ApiResponse.success(task);
    }

    @PutMapping("/{taskId}/approve")
    @Operation(summary = "审批任务", description = "审批指定的任务，可通过或驳回")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<ApprovalTask> approveTask(
            @PathVariable Long taskId,
            @Parameter(description = "是否批准") @RequestParam boolean approved,
            @Parameter(description = "审批意见") @RequestParam(required = false) String comment) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        ApprovalTask task = approvalService.approveTaskByUsername(taskId, username, approved, comment);
        return ApiResponse.success(approved ? "审批通过" : "审批驳回", task);
    }
}
