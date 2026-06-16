package com.emergency.auth.controller;

import com.emergency.auth.dto.ApprovalProcessRequest;
import com.emergency.auth.entity.Approval;
import com.emergency.auth.service.ApprovalService;
import com.emergency.common.dto.PageQuery;
import com.emergency.common.dto.PageResult;
import com.emergency.common.result.Result;
import com.emergency.common.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
@Tag(name = "审批管理", description = "审批流程管理接口")
public class ApprovalController {

    private final ApprovalService approvalService;

    @GetMapping("/pending")
    @Operation(summary = "获取待我审批的列表")
    public Result<List<Approval>> getPendingApprovals() {
        Long userId = SecurityUtils.getCurrentUserId();
        return Result.success(approvalService.getPendingApprovals(userId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取审批详情")
    public Result<Approval> getApprovalDetail(@PathVariable Long id) {
        return Result.success(approvalService.getApprovalById(id));
    }

    @GetMapping("/business/{businessType}/{businessId}")
    @Operation(summary = "获取业务关联的最新审批")
    public Result<Approval> getLatestApproval(@PathVariable String businessType, @PathVariable Long businessId) {
        return Result.success(approvalService.getLatestApproval(businessType, businessId));
    }

    @GetMapping("/list")
    @Operation(summary = "分页查询审批列表")
    public Result<PageResult<Approval>> getApprovalList(@Valid PageQuery query) {
        return Result.success(approvalService.getApprovalList(query));
    }

    @PostMapping("/process")
    @Operation(summary = "处理审批")
    public Result<Approval> processApproval(@Valid @RequestBody ApprovalProcessRequest request) {
        return Result.success(approvalService.processApproval(
                request.getApprovalId(),
                request.getStatus(),
                request.getOpinion()
        ));
    }
}
