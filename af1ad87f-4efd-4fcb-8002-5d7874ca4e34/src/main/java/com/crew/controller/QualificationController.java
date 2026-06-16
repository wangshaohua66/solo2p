package com.crew.controller;

import com.crew.common.ApiResponse;
import com.crew.common.PageResult;
import com.crew.dto.QualificationCreateRequest;
import com.crew.entity.Qualification;
import com.crew.service.QualificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "资质管理", description = "执照到期提醒、机型资格、体检有效期管理")
@RestController
@RequestMapping("/qualification")
@RequiredArgsConstructor
public class QualificationController {

    private final QualificationService qualificationService;

    @Operation(summary = "查询资质详情")
    @GetMapping("/{id}")
    public ApiResponse<Qualification> getById(
            @Parameter(description = "资质ID") @PathVariable Long id) {
        return ApiResponse.success(qualificationService.getById(id));
    }

    @Operation(summary = "查询某机组人员的全部资质")
    @GetMapping("/crew/{crewId}")
    public ApiResponse<List<Qualification>> listByCrewId(
            @Parameter(description = "机组人员ID") @PathVariable Long crewId) {
        return ApiResponse.success(qualificationService.listByCrewId(crewId));
    }

    @Operation(summary = "分页查询资质列表")
    @GetMapping
    public ApiResponse<PageResult<Qualification>> list(
            @Parameter(description = "机组人员ID") @RequestParam(required = false) Long crewId,
            @Parameter(description = "资质类型") @RequestParam(required = false) String qualType,
            @Parameter(description = "状态") @RequestParam(required = false) String status,
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(qualificationService.list(crewId, qualType, status, page, size));
    }

    @Operation(summary = "创建资质记录")
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<Qualification> create(@Valid @RequestBody QualificationCreateRequest request) {
        return ApiResponse.success(qualificationService.create(request));
    }

    @Operation(summary = "更新资质记录")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<Qualification> update(
            @Parameter(description = "资质ID") @PathVariable Long id,
            @Valid @RequestBody QualificationCreateRequest request) {
        return ApiResponse.success(qualificationService.update(id, request));
    }

    @Operation(summary = "删除资质记录")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(
            @Parameter(description = "资质ID") @PathVariable Long id) {
        qualificationService.delete(id);
        return ApiResponse.success();
    }

    @Operation(summary = "查询即将到期的资质（到期前N天内）")
    @GetMapping("/expiring")
    @PreAuthorize("hasRole('ADMIN') or hasRole('DISPATCHER')")
    public ApiResponse<List<Qualification>> findExpiring(
            @Parameter(description = "天数范围") @RequestParam(defaultValue = "30") int withinDays) {
        return ApiResponse.success(qualificationService.findExpiringQualifications(withinDays));
    }

    @Operation(summary = "手动触发过期资质处理")
    @PostMapping("/process-expired")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> processExpired() {
        qualificationService.processExpiredQualifications();
        return ApiResponse.success();
    }
}
