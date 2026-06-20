package com.tobacco.controller;

import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.Result;
import com.tobacco.dto.request.InspectionTaskQuery;
import com.tobacco.dto.request.ViolationRecordQuery;
import com.tobacco.dto.request.ViolationRecordRequest;
import com.tobacco.entity.InspectionTask;
import com.tobacco.entity.ViolationRecord;
import com.tobacco.service.InspectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "稽查执法", description = "稽查任务派发、违规记录录入、违规处理等接口")
@RestController
@RequestMapping("/inspection")
@RequiredArgsConstructor
public class InspectionController {

    private final InspectionService inspectionService;

    @Operation(summary = "自动派发稽查任务", description = "按辖区网格和零售户风险等级自动派发日常巡查任务")
    @PostMapping("/tasks/auto-assign")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<List<InspectionTask>> autoAssignTasks(
            @Parameter(description = "管理所ID") @RequestParam Long stationId,
            @Parameter(description = "稽查员ID") @RequestParam Long inspectorId,
            @Parameter(description = "稽查员姓名") @RequestParam String inspectorName) {
        return Result.success(inspectionService.autoAssignTasks(stationId, inspectorId, inspectorName));
    }

    @Operation(summary = "获取稽查任务详情", description = "根据任务ID获取稽查任务详细信息")
    @GetMapping("/tasks/{id}")
    @PreAuthorize("hasAnyRole('ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<InspectionTask> getTaskById(
            @Parameter(description = "任务ID") @PathVariable Long id) {
        return Result.success(inspectionService.getTaskById(id));
    }

    @Operation(summary = "分页查询稽查任务", description = "支持按状态、稽查员、辖区、风险等级等条件分页查询")
    @GetMapping("/tasks/page")
    @PreAuthorize("hasAnyRole('ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<PageResult<InspectionTask>> getTaskPage(InspectionTaskQuery query) {
        return Result.success(inspectionService.getTaskPage(query));
    }

    @Operation(summary = "录入违规记录", description = "现场巡查时录入违规类型和描述，触发信用扣分和许可证处罚")
    @PostMapping("/violations")
    @PreAuthorize("hasAnyRole('ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN')")
    public Result<ViolationRecord> recordViolation(@Valid @RequestBody ViolationRecordRequest request) {
        return Result.success(inspectionService.recordViolation(request, null, null));
    }

    @Operation(summary = "获取违规记录详情", description = "根据记录ID获取违规记录详细信息")
    @GetMapping("/violations/{id}")
    @PreAuthorize("hasAnyRole('ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<ViolationRecord> getViolationRecordById(
            @Parameter(description = "记录ID") @PathVariable Long id) {
        return Result.success(inspectionService.getViolationRecordById(id));
    }

    @Operation(summary = "分页查询违规记录", description = "支持按违规类型、严重程度、辖区等条件分页查询")
    @GetMapping("/violations/page")
    @PreAuthorize("hasAnyRole('ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<PageResult<ViolationRecord>> getViolationRecordPage(ViolationRecordQuery query) {
        return Result.success(inspectionService.getViolationRecordPage(query));
    }

    @Operation(summary = "查询零售户违规记录", description = "根据零售户ID查询所有违规记录")
    @GetMapping("/violations/retailer/{retailerId}")
    @PreAuthorize("hasAnyRole('ROLE_INSPECTOR', 'ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN', 'ROLE_RETAILER')")
    public Result<List<ViolationRecord>> getViolationRecordsByRetailer(
            @Parameter(description = "零售户ID") @PathVariable Long retailerId) {
        return Result.success(inspectionService.getViolationRecordsByRetailer(retailerId));
    }

    @Operation(summary = "处理违规记录", description = "对违规记录进行处理，填写处理意见")
    @PostMapping("/violations/{id}/dispose")
    @PreAuthorize("hasAnyRole('ROLE_COUNTY_ADMIN', 'ROLE_CITY_ADMIN')")
    public Result<ViolationRecord> disposeViolation(
            @Parameter(description = "记录ID") @PathVariable Long id,
            @Parameter(description = "处理意见") @RequestParam String disposalOpinion) {
        return Result.success(inspectionService.disposeViolation(id, disposalOpinion, null));
    }
}
