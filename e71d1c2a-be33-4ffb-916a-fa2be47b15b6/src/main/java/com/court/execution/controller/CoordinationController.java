package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.entity.CoordinationLetter;
import com.court.execution.entity.CoordinationUnit;
import com.court.execution.entity.PropertyType;
import com.court.execution.service.CoordinationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/coordination")
@Tag(name = "协执函管理", description = "协执函生成发送、协执单位管理、反馈接收等协执对接接口")
public class CoordinationController {

    private final CoordinationService coordinationService;

    public CoordinationController(CoordinationService coordinationService) {
        this.coordinationService = coordinationService;
    }

    @PostMapping("/letters")
    @Operation(summary = "生成协执函", description = "按财产类型自动生成标准协执函模板")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<CoordinationLetter> createLetter(
            @Parameter(description = "案件ID", required = true) @RequestParam Long caseId,
            @Parameter(description = "财产ID") @RequestParam(required = false) Long propertyId,
            @Parameter(description = "协执单位ID", required = true) @RequestParam Long unitId,
            @Parameter(description = "协执函类型") @RequestParam(defaultValue = "查询") String letterType) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        CoordinationLetter letter = coordinationService.createLetter(caseId, propertyId, unitId, letterType, username);
        return ApiResponse.success("协执函生成成功", letter);
    }

    @GetMapping("/letters/{id}")
    @Operation(summary = "获取协执函详情")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<CoordinationLetter> getLetterById(@PathVariable Long id) {
        CoordinationLetter letter = coordinationService.getLetterById(id);
        return ApiResponse.success(letter);
    }

    @GetMapping("/letters/case/{caseId}")
    @Operation(summary = "获取案件协执函列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<CoordinationLetter>> getLettersByCaseId(@PathVariable Long caseId) {
        List<CoordinationLetter> letters = coordinationService.getLettersByCaseId(caseId);
        return ApiResponse.success(letters);
    }

    @GetMapping("/letters/status/{status}")
    @Operation(summary = "按状态查询协执函")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<Page<CoordinationLetter>> getLettersByStatus(
            @PathVariable String status,
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createTime"));
        Page<CoordinationLetter> letters = coordinationService.getLettersByStatus(status, pageable);
        return ApiResponse.success(letters);
    }

    @PostMapping("/letters/{id}/send")
    @Operation(summary = "发送协执函", description = "发送协执函至对应协执单位")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<CoordinationLetter> sendLetter(@PathVariable Long id) {
        CoordinationLetter letter = coordinationService.sendLetter(id);
        return ApiResponse.success("协执函已发送", letter);
    }

    @PostMapping("/letters/batch-send")
    @Operation(summary = "批量发送协执函", description = "批量发送多份协执函")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<List<CoordinationLetter>> batchSendLetters(@RequestBody List<Long> letterIds) {
        List<CoordinationLetter> letters = coordinationService.batchSendLetters(letterIds);
        return ApiResponse.success("批量发送成功，共" + letters.size() + "份", letters);
    }

    @PostMapping("/letters/batch-send-by-type")
    @Operation(summary = "按案件和财产类型批量发送协执函", description = "批量生成并发送协执函至对应协执单位")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<List<CoordinationLetter>> batchSendByCaseAndType(
            @Parameter(description = "案件ID", required = true) @RequestParam Long caseId,
            @Parameter(description = "财产类型", required = true) @RequestParam PropertyType propertyType,
            @Parameter(description = "协执类型") @RequestParam(defaultValue = "查询") String letterType) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        List<CoordinationLetter> letters = coordinationService.batchSendByCaseAndType(caseId, propertyType, letterType, username);
        return ApiResponse.success("批量发送成功，共" + letters.size() + "份", letters);
    }

    @PostMapping("/letters/{id}/feedback")
    @Operation(summary = "录入协执反馈", description = "在线录入反馈时间、反馈内容")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<CoordinationLetter> submitFeedback(
            @PathVariable Long id,
            @Parameter(description = "反馈内容", required = true) @RequestParam String feedbackContent) {
        CoordinationLetter letter = coordinationService.submitFeedback(id, feedbackContent);
        return ApiResponse.success("反馈已录入", letter);
    }

    @GetMapping("/units")
    @Operation(summary = "获取所有协执单位")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<CoordinationUnit>> getAllUnits() {
        List<CoordinationUnit> units = coordinationService.getAllUnits();
        return ApiResponse.success(units);
    }

    @GetMapping("/units/type/{propertyType}")
    @Operation(summary = "按财产类型获取协执单位")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<CoordinationUnit>> getUnitsByPropertyType(@PathVariable PropertyType propertyType) {
        List<CoordinationUnit> units = coordinationService.getUnitsByPropertyType(propertyType);
        return ApiResponse.success(units);
    }

    @PostMapping("/units")
    @Operation(summary = "新增协执单位")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CoordinationUnit> createUnit(@RequestBody CoordinationUnit unit) {
        CoordinationUnit savedUnit = coordinationService.createUnit(unit);
        return ApiResponse.success("新增成功", savedUnit);
    }

    @PutMapping("/units/{id}")
    @Operation(summary = "更新协执单位")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CoordinationUnit> updateUnit(@PathVariable Long id, @RequestBody CoordinationUnit unit) {
        CoordinationUnit updatedUnit = coordinationService.updateUnit(id, unit);
        return ApiResponse.success("更新成功", updatedUnit);
    }

    @DeleteMapping("/units/{id}")
    @Operation(summary = "删除协执单位")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteUnit(@PathVariable Long id) {
        coordinationService.deleteUnit(id);
        return ApiResponse.success("删除成功", null);
    }

    @GetMapping("/letters/reminder/pending")
    @Operation(summary = "获取待催办协执函", description = "获取超时未反馈的协执函列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<List<CoordinationLetter>> getLettersNeedingReminder(
            @Parameter(description = "超时时长（小时）") @RequestParam(defaultValue = "72") int timeoutHours) {
        List<CoordinationLetter> letters = coordinationService.getLettersNeedingReminder(timeoutHours);
        return ApiResponse.success(letters);
    }

    @PostMapping("/letters/reminder/send")
    @Operation(summary = "批量发送催办提醒", description = "对超时未反馈的协执函发送催办提醒")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'ADMIN')")
    public ApiResponse<Integer> sendReminders(
            @Parameter(description = "超时时长（小时）") @RequestParam(defaultValue = "72") int timeoutHours) {
        int count = coordinationService.sendReminders(timeoutHours);
        return ApiResponse.success("催办提醒已发送，共" + count + "份", count);
    }
}
