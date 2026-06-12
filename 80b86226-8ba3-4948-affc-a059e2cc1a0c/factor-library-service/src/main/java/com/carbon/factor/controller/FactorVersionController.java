package com.carbon.factor.controller;

import com.carbon.common.api.PageQuery;
import com.carbon.common.api.PageResult;
import com.carbon.common.api.R;
import com.carbon.common.enums.FactorLibrary;
import com.carbon.factor.entity.FactorChangeLog;
import com.carbon.factor.entity.FactorVersion;
import com.carbon.factor.service.FactorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/factor-versions")
@RequiredArgsConstructor
@Tag(name = "因子版本", description = "版本管理、发布、锁定")
public class FactorVersionController {

    private final FactorService service;

    @PostMapping
    @Operation(summary = "创建新版本(从baseVersion或空库)")
    public R<FactorVersion> create(@RequestBody FactorVersion version) {
        return R.ok(service.createVersion(version));
    }

    @GetMapping
    @Operation(summary = "查询因子库版本列表")
    public R<PageResult<FactorVersion>> list(
            @Parameter(description = "因子库") @RequestParam(required = false) FactorLibrary library,
            @ParameterObject PageQuery pageQuery) {
        return R.ok(service.listVersions(library, pageQuery));
    }

    @GetMapping("/{library}/{versionCode}")
    @Operation(summary = "查询指定版本详情")
    public R<FactorVersion> get(@PathVariable FactorLibrary library,
                                @PathVariable String versionCode) {
        return R.ok(service.getVersion(library, versionCode));
    }

    @PostMapping("/{library}/{versionCode}/lock")
    @Operation(summary = "锁定版本，禁止后续修改")
    public R<FactorVersion> lock(@PathVariable FactorLibrary library,
                                 @PathVariable String versionCode) {
        return R.ok(service.lockVersion(library, versionCode));
    }

    @GetMapping("/{library}/{versionTo}/changelogs")
    @Operation(summary = "某版本的全部因子变更日志")
    public R<PageResult<FactorChangeLog>> listChangeLogs(
            @PathVariable FactorLibrary library,
            @PathVariable String versionTo,
            @ParameterObject PageQuery pageQuery) {
        return R.ok(service.listChangeLogs(library, versionTo, pageQuery));
    }
}
