package com.carbon.factor.controller;

import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.common.enums.ActivityDataType;
import com.carbon.common.enums.FactorLibrary;
import com.carbon.common.enums.GreenhouseGas;
import com.carbon.common.enums.ScopeType;
import com.carbon.factor.entity.EmissionFactor;
import com.carbon.factor.entity.FactorChangeLog;
import com.carbon.factor.entity.FactorVersion;
import com.carbon.factor.service.FactorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/factors")
@RequiredArgsConstructor
@Tag(name = "排放因子", description = "IPCC/MEE/CBAM多套因子库、版本管理与变更追踪")
public class FactorController {

    private final FactorService service;

    @PostMapping
    @Operation(summary = "创建排放因子")
    public R<EmissionFactor> create(@RequestBody EmissionFactor factor) {
        return R.ok(service.create(factor));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新排放因子(自动写入变更日志)")
    public R<EmissionFactor> update(@PathVariable String id, @RequestBody EmissionFactor factor) {
        return R.ok(service.update(id, factor));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除排放因子")
    public R<Void> delete(@PathVariable String id) {
        service.delete(id);
        return R.ok();
    }

    @GetMapping("/{id}")
    @Operation(summary = "按ID查询因子")
    public R<EmissionFactor> getById(@PathVariable String id) {
        return R.ok(service.getById(id));
    }

    @GetMapping
    @Operation(summary = "分页查询因子列表")
    public R<PageResult<EmissionFactor>> list(
            @Parameter(description = "因子库 IPCC_2006/IPCC_2019/MEE_2022/MEE_2024/CBAM_2024")
            @RequestParam(required = false) FactorLibrary library,
            @Parameter(description = "版本号") @RequestParam(required = false) String versionCode,
            @Parameter(description = "排放范围") @RequestParam(required = false) ScopeType scope,
            @Parameter(description = "活动数据类型") @RequestParam(required = false) ActivityDataType type,
            @Parameter(description = "名称/编码关键字") @RequestParam(required = false) String keyword,
            @ParameterObject PageQuery pageQuery) {
        return R.ok(service.list(library, versionCode, scope, type, keyword, pageQuery));
    }

    @GetMapping("/match")
    @Operation(summary = "按数据期间自动匹配对应版本因子")
    public R<EmissionFactor> matchByPeriod(
            @Parameter(required = true) @RequestParam FactorLibrary library,
            @Parameter(required = true, description = "匹配键") @RequestParam String matchKey,
            @Parameter(required = true, description = "期间 YYYY-MM") @RequestParam String period) {
        return R.ok(service.matchByPeriod(library, matchKey, YearMonth.parse(period)));
    }

    @GetMapping("/by-version")
    @Operation(summary = "按指定版本精确查找")
    public R<EmissionFactor> byVersion(
            @Parameter(required = true) @RequestParam FactorLibrary library,
            @Parameter(required = true) @RequestParam String versionCode,
            @Parameter(required = true) @RequestParam String matchKey,
            @Parameter(description = "温室气体类型") @RequestParam(required = false) GreenhouseGas gas) {
        return R.ok(service.getByVersion(library, versionCode, matchKey, gas));
    }

    @GetMapping("/latest")
    @Operation(summary = "取某匹配键的最新版本因子")
    public R<EmissionFactor> latest(
            @Parameter(required = true) @RequestParam FactorLibrary library,
            @Parameter(required = true) @RequestParam String matchKey) {
        return R.ok(service.getLatest(library, matchKey));
    }

    @PostMapping("/bulk-match")
    @Operation(summary = "批量匹配(用于核算引擎加速)")
    public R<Map<String, EmissionFactor>> bulkMatch(
            @Parameter(required = true) @RequestParam FactorLibrary library,
            @Parameter(required = true) @RequestParam String versionCode,
            @RequestBody List<String> matchKeys) {
        return R.ok(service.bulkMatch(library, versionCode, matchKeys));
    }

    @GetMapping("/changelog/{library}/{matchKey}")
    @Operation(summary = "单因子变更历史(双向追溯)")
    public R<List<FactorChangeLog>> changelog(
            @PathVariable FactorLibrary library,
            @PathVariable String matchKey) {
        return R.ok(service.getChangeLogs(library, matchKey));
    }

    @GetMapping("/diff")
    @Operation(summary = "两版本对比(新增/删除/变更+变动百分比)")
    public R<Map<String, Object>> diff(
            @Parameter(required = true) @RequestParam FactorLibrary library,
            @Parameter(required = true) @RequestParam String versionFrom,
            @Parameter(required = true) @RequestParam String versionTo) {
        return R.ok(service.diff(library, versionFrom, versionTo));
    }

    @GetMapping("/stats")
    @Operation(summary = "因子库总览统计")
    public R<Map<String, Object>> stats() {
        return R.ok(service.stats());
    }
}
