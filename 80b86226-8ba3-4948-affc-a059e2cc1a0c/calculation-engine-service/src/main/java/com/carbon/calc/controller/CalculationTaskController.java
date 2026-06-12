package com.carbon.calc.controller;

import com.carbon.calc.entity.CalculationTask;
import com.carbon.calc.service.CalculationService;
import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.common.enums.AccountingStandard;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/calculation-tasks")
@RequiredArgsConstructor
@Tag(name = "核算任务", description = "月度核算任务提交、进度、结果汇总")
public class CalculationTaskController {

    private final CalculationService service;

    @PostMapping
    @Operation(summary = "提交月度核算任务(异步，三标准并行)",
            description = "同批活动数据按 ISO 14064-1 / GHG Protocol / CBAM 三套方法学同时输出")
    @PreAuthorize("hasAuthority('calculation:run')")
    public R<CalculationTask> submit(
            @Parameter(required = true, example = "2024") @RequestParam Integer year,
            @Parameter(required = true, example = "6") @RequestParam Integer month,
            @Parameter(description = "核算标准列表，默认三标准全开") @RequestParam(required = false) List<AccountingStandard> standards,
            @Parameter(description = "指定排放源ID列表，空=全部") @RequestParam(required = false) List<String> sourceIds,
            @Parameter(description = "按SCOPE过滤") @RequestParam(required = false) String scope,
            @Parameter(description = "任务名称") @RequestParam(required = false) String taskName,
            @Parameter(description = "关联证据ID列表(证据链校验，必填)") @RequestParam(required = true) List<String> evidenceIds) {
        return R.ok(service.submitTask(year, month, standards, sourceIds, scope, taskName, evidenceIds));
    }

    @GetMapping
    @Operation(summary = "分页查询核算任务列表")
    public R<PageResult<CalculationTask>> list(@ParameterObject PageQuery pageQuery) {
        return R.ok(service.listTasks(pageQuery));
    }

    @GetMapping("/{taskId}")
    @Operation(summary = "获取任务状态/进度")
    public R<CalculationTask> get(@PathVariable String taskId) {
        return R.ok(service.getTask(taskId));
    }

    @GetMapping("/{taskId}/summary")
    @Operation(summary = "任务汇总(各标准总量+按气体/范围分解)")
    public R<Map<String, Object>> summary(@PathVariable String taskId) {
        return R.ok(service.taskSummary(taskId));
    }
}
