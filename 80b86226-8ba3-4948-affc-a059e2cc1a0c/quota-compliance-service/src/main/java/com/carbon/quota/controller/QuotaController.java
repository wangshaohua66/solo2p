package com.carbon.quota.controller;

import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.quota.entity.QuotaAllocation;
import com.carbon.quota.entity.QuotaLedger;
import com.carbon.quota.service.QuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.*;

import com.carbon.quota.entity.CcerTransfer;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/quotas")
@RequiredArgsConstructor
@Tag(name = "配额管理", description = "年度配额分配、月度滚动对账、Dashboard")
public class QuotaController {

    private final QuotaService service;

    @PostMapping("/allocations")
    @Operation(summary = "创建年度配额分配(免费+有偿+预分配)")
    public R<QuotaAllocation> createAllocation(@RequestBody QuotaAllocation allocation) {
        return R.ok(service.createAllocation(allocation));
    }

    @GetMapping("/allocations")
    @Operation(summary = "查询某年度配额分配列表")
    public R<List<QuotaAllocation>> listAllocations(
            @Parameter(required = true) @RequestParam Integer year) {
        return R.ok(service.listAllocations(year));
    }

    @GetMapping("/allocations/page")
    @Operation(summary = "分页查询配额分配历史")
    public R<PageResult<QuotaAllocation>> pageAllocations(@ParameterObject PageQuery pq) {
        return R.ok(service.pageAllocations(pq));
    }

    @GetMapping("/allocations/{id}")
    @Operation(summary = "查询配额分配详情")
    public R<QuotaAllocation> getAllocation(@PathVariable String id) {
        return R.ok(service.getAllocation(id));
    }

    @PostMapping("/reconcile")
    @Operation(summary = "月度配额对账(自动计算累计排放、预计年末缺口、分级预警)",
            description = "每月自动或手动触发；缺口超阈值自动通过钉钉/飞书推送部门/企业/集团三层预警")
    public R<QuotaLedger> reconcile(
            @Parameter(required = true) @RequestParam Integer year,
            @Parameter(required = true) @RequestParam Integer month,
            @Parameter(description = "机构ID") @RequestParam String organizationId,
            @Parameter(description = "本月实际排放量 tCO2e", required = true) @RequestParam BigDecimal actualEmission,
            @Parameter(description = "关联核算任务ID") @RequestParam(required = false) String calculationTaskId,
            @Parameter(description = "关联证据ID列表(证据链校验)") @RequestParam(required = false) List<String> evidenceIds) {
        return R.ok(service.reconcileMonth(year, month, organizationId, actualEmission, calculationTaskId, evidenceIds));
    }

    @GetMapping("/ledgers")
    @Operation(summary = "查询某年度12个月台账(按月份升序)")
    public R<List<QuotaLedger>> listLedgers(@RequestParam Integer year) {
        return R.ok(service.listLedgers(year));
    }

    @GetMapping("/dashboard")
    @Operation(summary = "履约 Dashboard(年度概览+配额+排放+抵消+预警统计)")
    public R<Map<String, Object>> dashboard(@RequestParam Integer year) {
        return R.ok(service.dashboard(year));
    }

    @PostMapping("/ccer-transfers/auto-transfer")
    @Operation(summary = "CCER签发量自动转入履约账户(跨服务调用)",
            description = "CCER服务签发后自动调用，转入对应年度配额抵消账户")
    public R<CcerTransfer> autoTransferFromIssuance(@RequestBody Map<String, Object> request) {
        return R.ok(service.autoTransferFromIssuance(request));
    }
}
