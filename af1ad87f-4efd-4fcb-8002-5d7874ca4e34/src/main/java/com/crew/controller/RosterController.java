package com.crew.controller;

import com.crew.common.ApiResponse;
import com.crew.common.PageResult;
import com.crew.dto.ConflictVO;
import com.crew.dto.RosterGenerateRequest;
import com.crew.dto.RosterPlanCompareVO;
import com.crew.dto.RosterPlanVO;
import com.crew.dto.SwapCandidateVO;
import com.crew.dto.SwapRequestDTO;
import com.crew.entity.Roster;
import com.crew.entity.RosterPlan;
import com.crew.service.RosterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "排班方案管理", description = "排班生成、审批、调整、查询、调班、冲突检测")
@RestController
@RequestMapping("/api/v1/roster")
@RequiredArgsConstructor
public class RosterController {

    private final RosterService rosterService;

    @Operation(summary = "生成多方案排班并对比评分")
    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<RosterPlanCompareVO> generate(@Valid @RequestBody RosterGenerateRequest request) {
        return ApiResponse.success(rosterService.generate(request));
    }

    @Operation(summary = "选择排班方案（从多方案中选定一个）")
    @PostMapping("/{planId}/select")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<RosterPlanVO> selectPlan(
            @Parameter(description = "选中的排班方案ID") @PathVariable Long planId,
            Authentication authentication) {
        return ApiResponse.success(rosterService.selectPlan(planId, authentication.getName()));
    }

    @Operation(summary = "审批排班方案")
    @PostMapping("/{planId}/approve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<Void> approve(
            @Parameter(description = "排班方案ID") @PathVariable Long planId,
            Authentication authentication) {
        rosterService.approve(planId, authentication.getName());
        return ApiResponse.success();
    }

    @Operation(summary = "查询排班方案详情")
    @GetMapping("/plan/{planId}")
    public ApiResponse<RosterPlanVO> getPlanDetail(
            @Parameter(description = "排班方案ID") @PathVariable Long planId) {
        return ApiResponse.success(rosterService.getPlanDetail(planId));
    }

    @Operation(summary = "分页查询排班方案列表")
    @GetMapping("/plans")
    public ApiResponse<PageResult<RosterPlan>> listPlans(
            @Parameter(description = "状态") @RequestParam(required = false) String status,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(rosterService.listPlans(status, page, size));
    }

    @Operation(summary = "分页查询排班记录")
    @GetMapping
    public ApiResponse<PageResult<Roster>> query(
            @Parameter(description = "开始日期") @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @Parameter(description = "机组人员ID") @RequestParam(required = false) Long crewId,
            @Parameter(description = "状态") @RequestParam(required = false) String status,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(rosterService.query(startDate, endDate, crewId, status, page, size));
    }

    @Operation(summary = "查找调班候选人员")
    @PostMapping("/swap/candidates")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<List<SwapCandidateVO>> findSwapCandidates(@Valid @RequestBody SwapRequestDTO request) {
        return ApiResponse.success(rosterService.findSwapCandidates(request));
    }

    @Operation(summary = "执行调班")
    @PostMapping("/swap/apply")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<Void> applySwap(
            @Parameter(description = "排班记录ID") @RequestParam Long rosterId,
            @Parameter(description = "替代人员ID") @RequestParam Long targetCrewId) {
        rosterService.applySwap(rosterId, targetCrewId);
        return ApiResponse.success();
    }

    @Operation(summary = "排班冲突检测")
    @PostMapping("/conflicts")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<List<ConflictVO>> detectConflicts(
            @Parameter(description = "开始日期") @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate) {
        return ApiResponse.success(rosterService.detectConflicts(startDate, endDate));
    }
}
