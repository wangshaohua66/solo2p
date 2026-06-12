package com.carbon.calc.controller;

import com.carbon.calc.entity.CalculationDiff;
import com.carbon.calc.entity.CalculationResult;
import com.carbon.calc.entity.CalculationTask;
import com.carbon.calc.service.CalculationService;
import com.carbon.common.api.R;
import com.carbon.common.enums.AccountingStandard;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/calculations")
@RequiredArgsConstructor
@Tag(name = "核算结果与差异", description = "三标准结果列表、差异定位到公式/因子级别")
public class CalculationController {

    private final CalculationService service;

    @GetMapping("/tasks/{taskId}/results")
    @Operation(summary = "按标准查询核算结果明细列表",
            description = "standard为空返回全部；每条包含活动值、因子、公式、参数、气体量、CO2e")
    public R<List<CalculationResult>> listResults(
            @PathVariable String taskId,
            @Parameter(description = "ISO_14064_1 | GHG_PROTOCOL | CBAM")
            @RequestParam(required = false) AccountingStandard standard) {
        return R.ok(service.listResults(taskId, standard));
    }

    @GetMapping("/tasks/{taskId}/diffs")
    @Operation(summary = "标准间差异对比，按绝对差值降序",
            description = "逐排放源逐气体定位：因子取值不同/GWP不同/公式边界不同")
    public R<List<CalculationDiff>> listDiffs(
            @PathVariable String taskId,
            @Parameter(description = "标准A") @RequestParam(required = false) AccountingStandard standardA,
            @Parameter(description = "标准B") @RequestParam(required = false) AccountingStandard standardB) {
        return R.ok(service.listDiffs(taskId, standardA, standardB));
    }

    @PostMapping("/tasks/{taskId}/rerun")
    @Operation(summary = "重算指定任务(清除旧结果+重算)")
    public R<Map<String, Object>> rerun(@PathVariable String taskId) {
        CalculationTask t = service.getTask(taskId);
        String scope = t.getScopeFilter() != null && !t.getScopeFilter().isEmpty()
                ? t.getScopeFilter().get(0) : null;
        CalculationTask fresh = service.submitTask(
                t.getPeriodYear(), t.getPeriodMonth(),
                t.getStandards(), t.getSourceIds(),
                scope,
                "重算-" + t.getTaskName(),
                t.getEvidenceIds());
        return R.ok(Map.of("newTaskId", fresh.getId(), "period", fresh.getPeriod()));
    }
}
