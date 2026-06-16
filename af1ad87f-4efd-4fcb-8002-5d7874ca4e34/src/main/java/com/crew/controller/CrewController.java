package com.crew.controller;

import com.crew.common.ApiResponse;
import com.crew.common.PageResult;
import com.crew.dto.CrewCreateRequest;
import com.crew.dto.CrewUpdateRequest;
import com.crew.entity.CrewMember;
import com.crew.service.CrewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "机组人员管理", description = "机组人员增删改查与资质维护")
@RestController
@RequestMapping("/api/v1/crew")
@RequiredArgsConstructor
public class CrewController {

    private final CrewService crewService;

    @Operation(summary = "查询机组人员详情")
    @GetMapping("/{id}")
    public ApiResponse<CrewMember> getById(
            @Parameter(description = "机组人员ID") @PathVariable Long id) {
        return ApiResponse.success(crewService.getById(id));
    }

    @Operation(summary = "分页查询机组人员列表")
    @GetMapping
    public ApiResponse<PageResult<CrewMember>> list(
            @Parameter(description = "人员类型: PILOT/ATTENDANT") @RequestParam(required = false) String type,
            @Parameter(description = "状态: AVAILABLE/ON_DUTY/LEAVE/GROUNDED") @RequestParam(required = false) String status,
            @Parameter(description = "基地") @RequestParam(required = false) String base,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(crewService.list(type, status, base, page, size));
    }

    @Operation(summary = "创建机组人员")
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<CrewMember> create(@Valid @RequestBody CrewCreateRequest request) {
        return ApiResponse.success(crewService.create(request));
    }

    @Operation(summary = "更新机组人员信息")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<CrewMember> update(
            @Parameter(description = "机组人员ID") @PathVariable Long id,
            @Valid @RequestBody CrewUpdateRequest request) {
        return ApiResponse.success(crewService.update(id, request));
    }

    @Operation(summary = "删除机组人员")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(
            @Parameter(description = "机组人员ID") @PathVariable Long id) {
        crewService.delete(id);
        return ApiResponse.success();
    }
}
