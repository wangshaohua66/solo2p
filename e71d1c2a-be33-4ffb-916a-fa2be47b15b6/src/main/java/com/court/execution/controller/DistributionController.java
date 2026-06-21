package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.entity.DistributionDetail;
import com.court.execution.entity.DistributionPlan;
import com.court.execution.entity.FundRecord;
import com.court.execution.service.DistributionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/distribution")
@Tag(name = "款项分配管理", description = "款项到账登记、分配方案计算、发放审批等款项分配接口")
public class DistributionController {

    private final DistributionService distributionService;

    public DistributionController(DistributionService distributionService) {
        this.distributionService = distributionService;
    }

    @PostMapping("/funds")
    @Operation(summary = "到账登记", description = "录入款项来源、金额、到账时间")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<FundRecord> registerFund(
            @Parameter(description = "案件ID", required = true) @RequestParam Long caseId,
            @Parameter(description = "款项类型", required = true) @RequestParam String fundType,
            @Parameter(description = "金额", required = true) @RequestParam BigDecimal amount,
            @Parameter(description = "款项来源") @RequestParam(required = false) String source,
            @Parameter(description = "到账时间") @RequestParam(required = false) LocalDateTime receivedDate,
            @Parameter(description = "付款人") @RequestParam(required = false) String payerName) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        FundRecord fund = distributionService.registerFund(caseId, fundType, amount,
                source, receivedDate, payerName, username);
        return ApiResponse.success("到账登记成功", fund);
    }

    @GetMapping("/funds/{id}")
    @Operation(summary = "获取款项详情")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<FundRecord> getFundById(@PathVariable Long id) {
        FundRecord fund = distributionService.getFundById(id);
        return ApiResponse.success(fund);
    }

    @GetMapping("/funds/case/{caseId}")
    @Operation(summary = "获取案件款项列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<FundRecord>> getFundsByCaseId(@PathVariable Long caseId) {
        List<FundRecord> funds = distributionService.getFundsByCaseId(caseId);
        return ApiResponse.success(funds);
    }

    @GetMapping("/funds/case/{caseId}/page")
    @Operation(summary = "分页获取案件款项列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Page<FundRecord>> getFundsByCaseIdPaged(
            @PathVariable Long caseId,
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createTime"));
        Page<FundRecord> funds = distributionService.getFundsByCaseId(caseId, pageable);
        return ApiResponse.success(funds);
    }

    @GetMapping("/funds/case/{caseId}/total")
    @Operation(summary = "获取案件到账总额")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<BigDecimal> getTotalFundByCaseId(@PathVariable Long caseId) {
        BigDecimal total = distributionService.getTotalFundByCaseId(caseId);
        return ApiResponse.success(total);
    }

    @PostMapping("/plans")
    @Operation(summary = "创建分配方案", description = "按法定顺序计算各债权人分配金额")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<DistributionPlan> createDistributionPlan(
            @Parameter(description = "案件ID", required = true) @RequestParam Long caseId,
            @Parameter(description = "执行费") @RequestParam(required = false) BigDecimal executionFee,
            @Parameter(description = "诉讼费") @RequestParam(required = false) BigDecimal litigationFee,
            @Parameter(description = "评估费") @RequestParam(required = false) BigDecimal evaluationFee,
            @Parameter(description = "拍卖费") @RequestParam(required = false) BigDecimal auctionFee) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        DistributionPlan plan = distributionService.createDistributionPlan(caseId, username,
                executionFee, litigationFee, evaluationFee, auctionFee);
        return ApiResponse.success("分配方案创建成功", plan);
    }

    @GetMapping("/plans/{id}")
    @Operation(summary = "获取分配方案详情")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<DistributionPlan> getPlanById(@PathVariable Long id) {
        DistributionPlan plan = distributionService.getPlanById(id);
        return ApiResponse.success(plan);
    }

    @GetMapping("/plans/case/{caseId}")
    @Operation(summary = "获取案件分配方案列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<DistributionPlan>> getPlansByCaseId(@PathVariable Long caseId) {
        List<DistributionPlan> plans = distributionService.getPlansByCaseId(caseId);
        return ApiResponse.success(plans);
    }

    @PostMapping("/plans/{planId}/details")
    @Operation(summary = "添加分配明细", description = "添加债权人分配明细")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<DistributionDetail> addDistributionDetail(
            @PathVariable Long planId,
            @RequestBody DistributionDetail detail) {
        DistributionDetail savedDetail = distributionService.addDistributionDetail(planId, detail);
        return ApiResponse.success("分配明细添加成功", savedDetail);
    }

    @PostMapping("/plans/{id}/calculate")
    @Operation(summary = "计算分配方案", description = "按法定顺序和债权比例计算各债权人分配金额")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<DistributionPlan> calculateDistribution(@PathVariable Long id) {
        DistributionPlan plan = distributionService.calculateDistribution(id);
        return ApiResponse.success("分配计算完成", plan);
    }

    @PostMapping("/plans/{id}/approve")
    @Operation(summary = "审批分配方案", description = "分配方案需执行法官审批")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<DistributionPlan> approvePlan(
            @PathVariable Long id,
            @Parameter(description = "是否批准", required = true) @RequestParam boolean approved) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        DistributionPlan plan = distributionService.approvePlan(id, username, approved);
        return ApiResponse.success(approved ? "审批通过" : "审批驳回", plan);
    }

    @PostMapping("/plans/{id}/execute")
    @Operation(summary = "执行发放", description = "发放审批后生成发放凭证")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<DistributionPlan> executeDistribution(@PathVariable Long id) {
        DistributionPlan plan = distributionService.executeDistribution(id);
        return ApiResponse.success("款项已发放", plan);
    }
}
