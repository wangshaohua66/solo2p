package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.dto.PropertyRegisterRequest;
import com.court.execution.dto.SeizureRequest;
import com.court.execution.entity.Property;
import com.court.execution.entity.SeizureRecord;
import com.court.execution.service.PropertyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/properties")
@Tag(name = "财产查控管理", description = "财产登记、查封冻结、续封解封等财产控制接口")
public class PropertyController {

    private final PropertyService propertyService;

    public PropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    @PostMapping
    @Operation(summary = "财产登记", description = "登记银行存款、不动产、车辆、股权、债权等五类财产信息")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<Property> registerProperty(@Valid @RequestBody PropertyRegisterRequest request) {
        Property property = propertyService.registerProperty(request);
        return ApiResponse.success("财产登记成功", property);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取财产详情", description = "根据财产ID获取财产详细信息")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Property> getPropertyById(@PathVariable Long id) {
        Property property = propertyService.getPropertyById(id);
        return ApiResponse.success(property);
    }

    @GetMapping("/case/{caseId}")
    @Operation(summary = "获取案件财产列表", description = "获取指定案件下的所有财产信息")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<Property>> getPropertiesByCaseId(@PathVariable Long caseId) {
        List<Property> properties = propertyService.getPropertiesByCaseId(caseId);
        return ApiResponse.success(properties);
    }

    @GetMapping("/case/{caseId}/page")
    @Operation(summary = "分页获取案件财产列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Page<Property>> getPropertiesByCaseIdPaged(
            @PathVariable Long caseId,
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createTime"));
        Page<Property> properties = propertyService.getPropertiesByCaseId(caseId, pageable);
        return ApiResponse.success(properties);
    }

    @PostMapping("/seizure")
    @Operation(summary = "查封冻结", description = "对财产进行查封、冻结、扣押操作，记录查封文号、期限、协执单位")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<SeizureRecord> createSeizure(@Valid @RequestBody SeizureRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        SeizureRecord record = propertyService.createSeizure(request, username);
        return ApiResponse.success("查封冻结成功", record);
    }

    @GetMapping("/seizure/property/{propertyId}")
    @Operation(summary = "获取财产查封记录", description = "获取指定财产的所有查封记录")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<SeizureRecord>> getSeizureRecordsByPropertyId(@PathVariable Long propertyId) {
        List<SeizureRecord> records = propertyService.getSeizureRecordsByPropertyId(propertyId);
        return ApiResponse.success(records);
    }

    @GetMapping("/seizure/case/{caseId}")
    @Operation(summary = "获取案件查封记录", description = "获取指定案件的所有查封记录")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<SeizureRecord>> getSeizureRecordsByCaseId(@PathVariable Long caseId) {
        List<SeizureRecord> records = propertyService.getSeizureRecordsByCaseId(caseId);
        return ApiResponse.success(records);
    }

    @PutMapping("/seizure/{id}/approve")
    @Operation(summary = "审批查封", description = "审批查封冻结申请")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<SeizureRecord> approveSeizure(
            @PathVariable Long id,
            @Parameter(description = "是否批准") @RequestParam boolean approved) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        SeizureRecord record = propertyService.approveSeizure(id, username, approved);
        return ApiResponse.success("审批完成", record);
    }

    @PostMapping("/seizure/{id}/extend")
    @Operation(summary = "续封", description = "延长查封期限，续封需审批流程")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<SeizureRecord> extendSeizure(
            @PathVariable Long id,
            @Parameter(description = "新的到期时间") @RequestParam LocalDateTime newEndDate) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        SeizureRecord record = propertyService.extendSeizure(id, newEndDate, username);
        return ApiResponse.success("续封申请已提交", record);
    }

    @PostMapping("/seizure/{id}/release")
    @Operation(summary = "申请解封", description = "申请解除查封冻结，需审批流程")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<SeizureRecord> releaseSeizure(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        SeizureRecord record = propertyService.releaseSeizure(id, username);
        return ApiResponse.success("解封申请已提交", record);
    }

    @PutMapping("/seizure/{id}/release/confirm")
    @Operation(summary = "审批解封申请", description = "审批解封申请，批准后正式解除查封")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<SeizureRecord> confirmReleaseSeizure(
            @PathVariable Long id,
            @Parameter(description = "是否批准") @RequestParam boolean approved) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        SeizureRecord record = propertyService.confirmReleaseSeizure(id, username, approved);
        return ApiResponse.success(approved ? "解封成功" : "解封申请已驳回", record);
    }

    @PostMapping("/{id}/skip-disposal")
    @Operation(summary = "跳过财产处置", description = "对无需处置或无法处置的财产标记为跳过处置，可结案")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<Property> skipPropertyDisposal(
            @PathVariable Long id,
            @Parameter(description = "跳过处置原因") @RequestParam String reason) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        Property property = propertyService.skipPropertyDisposal(id, reason, username);
        return ApiResponse.success("已标记为跳过处置", property);
    }

    @GetMapping("/warning/expiring")
    @Operation(summary = "查封到期预警", description = "获取即将到期的查封财产列表，默认提前7天预警")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<List<Property>> getExpiringProperties(
            @Parameter(description = "提前预警天数") @RequestParam(defaultValue = "7") int days) {
        List<Property> properties = propertyService.getExpiringProperties(days);
        return ApiResponse.success(properties);
    }

    @GetMapping("/warning/expired")
    @Operation(summary = "已过期查封列表", description = "获取已过期的查封财产列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<List<Property>> getExpiredProperties() {
        List<Property> properties = propertyService.getExpiredProperties();
        return ApiResponse.success(properties);
    }
}
