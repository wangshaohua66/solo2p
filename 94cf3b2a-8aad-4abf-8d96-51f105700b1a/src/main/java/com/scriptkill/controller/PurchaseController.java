package com.scriptkill.controller;

import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.common.PageResult;
import com.scriptkill.dto.purchase.PurchaseCreateRequest;
import com.scriptkill.dto.purchase.PurchaseResponse;
import com.scriptkill.dto.purchase.PurchaseReviewRequest;
import com.scriptkill.service.AuthService;
import com.scriptkill.service.PurchaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/purchases")
@Tag(name = "09-本子采购", description = "新本子评审与入库流程")
public class PurchaseController {

    private final PurchaseService purchaseService;
    private final AuthService authService;

    public PurchaseController(PurchaseService purchaseService, AuthService authService) {
        this.purchaseService = purchaseService;
        this.authService = authService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "提交采购评审", description = "DM或管理员提交新本子评审申请")
    public ApiResponse<PurchaseResponse> submitPurchase(
            @Valid @RequestBody PurchaseCreateRequest request) {
        Long submitterId = authService.getCurrentUser().getId();
        PurchaseResponse response = purchaseService.submitPurchase(request, submitterId);
        return ApiResponse.success("评审申请已提交", response);
    }

    @PostMapping("/review")
    @PreAuthorize("hasAnyRole('DM', 'STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "盲测评分", description = "DM对新本子进行盲测评分，三人达标自动入库")
    public ApiResponse<PurchaseResponse> reviewPurchase(
            @Valid @RequestBody PurchaseReviewRequest request) {
        Long reviewerId = authService.getCurrentUser().getId();
        PurchaseResponse response = purchaseService.reviewPurchase(request, reviewerId);
        return ApiResponse.success("评审已提交", response);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "分页查询评审列表", description = "查看所有本子采购评审")
    public ApiResponse<PageResult<PurchaseResponse>> listPurchases(
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "状态: PENDING_REVIEW, APPROVED, REJECTED, CANDIDATE_POOL")
            @RequestParam(required = false) String status) {
        PageResult<PurchaseResponse> result = purchaseService.listPurchases(page, size, status);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取评审详情")
    public ApiResponse<PurchaseResponse> getPurchaseDetail(
            @Parameter(description = "评审ID") @PathVariable Long id) {
        PurchaseResponse response = purchaseService.getPurchaseDetail(id);
        return ApiResponse.success(response);
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'ADMIN')")
    @Operation(summary = "拒绝采购", description = "店长或管理员直接拒绝采购申请")
    public ApiResponse<PurchaseResponse> rejectPurchase(
            @Parameter(description = "评审ID") @PathVariable Long id,
            @Parameter(description = "拒绝原因") @RequestParam(required = false) String reason) {
        PurchaseResponse response = purchaseService.rejectPurchase(id, reason);
        return ApiResponse.success("已拒绝", response);
    }
}
