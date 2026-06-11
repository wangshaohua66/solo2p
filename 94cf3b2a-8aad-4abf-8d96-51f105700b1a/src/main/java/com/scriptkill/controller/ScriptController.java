package com.scriptkill.controller;

import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.common.PageResult;
import com.scriptkill.dto.script.ScriptCreateRequest;
import com.scriptkill.dto.script.ScriptDetailResponse;
import com.scriptkill.service.ScriptService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/scripts")
@Tag(name = "02-剧本管理", description = "剧本库增删改查、角色卡、阶段、线索管理")
public class ScriptController {

    private final ScriptService scriptService;

    public ScriptController(ScriptService scriptService) {
        this.scriptService = scriptService;
    }

    @GetMapping
    @Operation(summary = "分页查询剧本列表", description = "支持按类型、难度、人数筛选")
    public ApiResponse<PageResult<ScriptDetailResponse>> listScripts(
            @Parameter(description = "页码，从0开始") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "剧本类型") @RequestParam(required = false) String genre,
            @Parameter(description = "难度") @RequestParam(required = false) String difficulty,
            @Parameter(description = "最少玩家数") @RequestParam(required = false) Integer minPlayers,
            @Parameter(description = "最多玩家数") @RequestParam(required = false) Integer maxPlayers) {
        PageResult<ScriptDetailResponse> result = scriptService.listScripts(
                page, size, genre, difficulty, minPlayers, maxPlayers);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取剧本详情", description = "获取剧本完整信息，包括角色、阶段、线索")
    public ApiResponse<ScriptDetailResponse> getScriptDetail(
            @Parameter(description = "剧本ID") @PathVariable Long id) {
        ScriptDetailResponse response = scriptService.getScriptDetail(id);
        return ApiResponse.success(response);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'STORE_MANAGER')")
    @Operation(summary = "创建剧本", description = "创建新剧本，需要管理员或店长权限")
    public ApiResponse<ScriptDetailResponse> createScript(
            @Valid @RequestBody ScriptCreateRequest request) {
        ScriptDetailResponse response = scriptService.createScript(request);
        return ApiResponse.success("剧本创建成功", response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STORE_MANAGER')")
    @Operation(summary = "更新剧本", description = "更新剧本信息，自动生成版本快照")
    public ApiResponse<ScriptDetailResponse> updateScript(
            @Parameter(description = "剧本ID") @PathVariable Long id,
            @Valid @RequestBody ScriptCreateRequest request) {
        ScriptDetailResponse response = scriptService.updateScript(id, request);
        return ApiResponse.success("剧本更新成功", response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STORE_MANAGER')")
    @Operation(summary = "删除剧本", description = "软删除剧本")
    public ApiResponse<Void> deleteScript(
            @Parameter(description = "剧本ID") @PathVariable Long id) {
        scriptService.deleteScript(id);
        return ApiResponse.success("剧本删除成功", null);
    }

    @PostMapping("/{id}/rollback")
    @PreAuthorize("hasAnyRole('ADMIN', 'STORE_MANAGER')")
    @Operation(summary = "版本回滚", description = "回滚到上一个版本快照")
    public ApiResponse<ScriptDetailResponse> rollbackToVersion(
            @Parameter(description = "剧本ID") @PathVariable Long id,
            @Parameter(description = "目标版本号") @RequestParam Integer version) {
        ScriptDetailResponse response = scriptService.rollbackToVersion(id, version);
        return ApiResponse.success("版本回滚成功", response);
    }
}
