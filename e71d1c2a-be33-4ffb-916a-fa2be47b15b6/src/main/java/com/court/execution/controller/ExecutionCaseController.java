package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.dto.CaseFilingRequest;
import com.court.execution.entity.CaseStatus;
import com.court.execution.entity.ExecutionCase;
import com.court.execution.service.ExecutionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases")
@Tag(name = "案件管理", description = "执行案件立案、查询、状态流转、结案等接口")
public class ExecutionCaseController {

    private final ExecutionService executionService;

    public ExecutionCaseController(ExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping
    @Operation(summary = "案件立案", description = "新建执行案件，录入被执行人信息、执行依据、执行标的等")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<ExecutionCase> fileCase(@Valid @RequestBody CaseFilingRequest request) {
        ExecutionCase caseObj = executionService.fileCase(request);
        return ApiResponse.success("立案成功", caseObj);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取案件详情", description = "根据案件ID获取案件详细信息")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<ExecutionCase> getCaseById(@PathVariable Long id) {
        ExecutionCase caseObj = executionService.getCaseById(id);
        return ApiResponse.success(caseObj);
    }

    @GetMapping
    @Operation(summary = "案件列表查询", description = "支持按案号、被执行人、执行法官、案件状态多条件筛选")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Page<ExecutionCase>> searchCases(
            @Parameter(description = "案号（模糊匹配）") @RequestParam(required = false) String caseNumber,
            @Parameter(description = "被执行人姓名（模糊匹配）") @RequestParam(required = false) String debtorName,
            @Parameter(description = "执行法官ID") @RequestParam(required = false) Long judgeId,
            @Parameter(description = "案件状态") @RequestParam(required = false) CaseStatus status,
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createTime"));
        Page<ExecutionCase> cases = executionService.searchCases(caseNumber, debtorName, judgeId, status, pageable);
        return ApiResponse.success(cases);
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "更新案件状态", description = "案件状态流转：立案→查控→处置→分配→结案")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<ExecutionCase> updateCaseStatus(
            @PathVariable Long id,
            @Parameter(description = "新的案件状态") @RequestParam CaseStatus status) {
        ExecutionCase caseObj = executionService.updateCaseStatus(id, status);
        return ApiResponse.success("状态更新成功", caseObj);
    }

    @PostMapping("/{id}/close")
    @Operation(summary = "案件结案", description = "结案时自动校验财产处置完毕、款项分配完成")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<ExecutionCase> closeCase(@PathVariable Long id) {
        ExecutionCase caseObj = executionService.closeCase(id);
        return ApiResponse.success("结案成功", caseObj);
    }

    @GetMapping("/{id}/can-close")
    @Operation(summary = "检查是否可结案", description = "校验财产是否处置完毕、款项是否分配完成")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<Boolean> canCloseCase(@PathVariable Long id) {
        boolean canClose = executionService.canCloseCase(id);
        return ApiResponse.success(canClose);
    }
}
