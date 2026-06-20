package com.design.collaboration.controller;

import com.design.collaboration.common.ApiResponse;
import com.design.collaboration.dto.ApprovalRequest;
import com.design.collaboration.dto.ChangeCreateRequest;
import com.design.collaboration.entity.ChangeRequest;
import com.design.collaboration.enums.ChangeStatus;
import com.design.collaboration.service.ChangeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/change")
@Tag(name = "变更管理", description = "设计变更申请、审批流程")
public class ChangeController {

    @Autowired
    private ChangeService changeService;

    @GetMapping("/{id}")
    @Operation(summary = "获取变更详情（含审批记录）")
    public ApiResponse<ChangeRequest> getById(@Parameter(description = "变更ID") @PathVariable Long id) {
        ChangeRequest change = changeService.findById(id);
        if (change == null) {
            return ApiResponse.error("变更不存在");
        }
        return ApiResponse.success(change);
    }

    @GetMapping("/list")
    @Operation(summary = "变更列表查询")
    public ApiResponse<List<ChangeRequest>> list(
            @Parameter(description = "项目ID") @RequestParam(required = false) Long projectId,
            @Parameter(description = "状态") @RequestParam(required = false) ChangeStatus status,
            @Parameter(description = "申请人ID") @RequestParam(required = false) Long applicantId) {
        return ApiResponse.success(changeService.findByConditions(projectId, status, applicantId));
    }

    @PostMapping
    @Operation(summary = "创建设计变更申请")
    public ApiResponse<ChangeRequest> create(@Valid @RequestBody ChangeCreateRequest request, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("创建成功", changeService.create(request, userId));
    }

    @PostMapping("/{id}/submit")
    @Operation(summary = "提交变更审批")
    public ApiResponse<ChangeRequest> submit(@Parameter(description = "变更ID") @PathVariable Long id, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("提交成功", changeService.submit(id, userId));
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "审批变更（通过/驳回）")
    public ApiResponse<ChangeRequest> approve(
            @Parameter(description = "变更ID") @PathVariable Long id,
            @Valid @RequestBody ApprovalRequest request,
            HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success(request.getApproved() ? "审批通过" : "审批驳回",
                changeService.approve(id, request, userId));
    }
}
