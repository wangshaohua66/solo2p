package com.iccert.task.controller;

import com.iccert.common.result.R;
import com.iccert.task.entity.LabAbilityScope;
import com.iccert.task.service.LabAbilityScopeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 实验室能力认可范围管理。
 * 网关路由：/api/task/ability-scope/** → 本控制器（StripPrefix=2）
 */
@Tag(name = "能力范围", description = "实验室能力认可范围维护")
@RestController
@RequestMapping("/ability-scope")
@RequiredArgsConstructor
public class LabAbilityScopeController {

    private final LabAbilityScopeService abilityScopeService;

    @Operation(summary = "获取所有能力认可范围")
    @GetMapping("/list")
    public R<List<LabAbilityScope>> list() {
        return R.ok(abilityScopeService.listAll());
    }

    @Operation(summary = "按实验室查询能力范围")
    @GetMapping("/lab/{labId}")
    public R<List<LabAbilityScope>> listByLab(@PathVariable Long labId) {
        return R.ok(abilityScopeService.listByLab(labId));
    }

    @Operation(summary = "获取能力范围详情")
    @GetMapping("/{id}")
    public R<LabAbilityScope> getById(@PathVariable Long id) {
        return R.ok(abilityScopeService.getById(id));
    }

    @Operation(summary = "新增能力范围")
    @PostMapping
    public R<LabAbilityScope> create(@RequestBody LabAbilityScope scope) {
        return R.ok(abilityScopeService.create(scope));
    }

    @Operation(summary = "更新能力范围")
    @PutMapping
    public R<LabAbilityScope> update(@RequestBody LabAbilityScope scope) {
        return R.ok(abilityScopeService.update(scope));
    }

    @Operation(summary = "删除能力范围")
    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        return R.ok(abilityScopeService.delete(id));
    }
}
