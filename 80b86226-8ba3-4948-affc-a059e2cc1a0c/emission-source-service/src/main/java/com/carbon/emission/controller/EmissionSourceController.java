package com.carbon.emission.controller;

import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.common.enums.ScopeType;
import com.carbon.emission.entity.EmissionSource;
import com.carbon.emission.service.EmissionSourceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/emission-sources")
@RequiredArgsConstructor
@Tag(name = "排放源档案", description = "Scope1/2/3排放源CRUD、搜索、批量导入")
public class EmissionSourceController {

    private final EmissionSourceService service;

    @PostMapping
    @Operation(summary = "创建排放源档案")
    public R<EmissionSource> create(@Valid @RequestBody EmissionSource source) {
        return R.ok(service.create(source));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新排放源档案")
    public R<EmissionSource> update(@PathVariable String id,
                                    @Valid @RequestBody EmissionSource source) {
        return R.ok(service.update(id, source));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除排放源档案")
    public R<Void> delete(@PathVariable String id) {
        service.delete(id);
        return R.ok();
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取排放源详情")
    public R<EmissionSource> getById(@PathVariable String id) {
        return R.ok(service.getById(id));
    }

    @GetMapping("/by-code/{code}")
    @Operation(summary = "按编码获取排放源")
    public R<EmissionSource> getByCode(@PathVariable String code) {
        return service.getByCode(code)
                .map(R::ok)
                .orElseGet(() -> R.ok(null));
    }

    @GetMapping
    @Operation(summary = "分页查询排放源")
    public R<PageResult<EmissionSource>> list(
            @Parameter(description = "排放范围过滤") @RequestParam(required = false) ScopeType scope,
            @Parameter(description = "名称/编码关键字") @RequestParam(required = false) String keyword,
            @Parameter(description = "状态 ACTIVE/INACTIVE") @RequestParam(required = false) String status,
            @ParameterObject PageQuery pageQuery) {
        return R.ok(service.list(scope, keyword, status, pageQuery));
    }

    @GetMapping("/brief")
    @Operation(summary = "获取排放源精简列表(用于下拉)")
    public R<List<EmissionSource>> listBrief() {
        return R.ok(service.listBrief());
    }

    @GetMapping("/stats")
    @Operation(summary = "排放源统计概览")
    public R<Map<String, Object>> stats() {
        return R.ok(service.stats());
    }

    @PostMapping("/batch-import")
    @Operation(summary = "批量导入排放源")
    public R<Map<String, Object>> batchImport(@RequestBody List<EmissionSource> sources) {
        return R.ok(service.batchImport(sources));
    }
}
