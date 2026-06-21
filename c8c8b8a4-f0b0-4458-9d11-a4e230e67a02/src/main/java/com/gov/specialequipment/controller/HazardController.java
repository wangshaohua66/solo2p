package com.gov.specialequipment.controller;

import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.common.Result;
import com.gov.specialequipment.dto.HazardCreateDTO;
import com.gov.specialequipment.dto.HazardQueryDTO;
import com.gov.specialequipment.dto.HazardRectifyDTO;
import com.gov.specialequipment.dto.HazardReviewDTO;
import com.gov.specialequipment.entity.HazardRecord;
import com.gov.specialequipment.service.HazardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "隐患排查治理")
@RestController
@RequestMapping("/hazards")
@RequiredArgsConstructor
public class HazardController {

    private final HazardService hazardService;

    @Operation(summary = "录入隐患信息")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<HazardRecord> createHazard(@Valid @RequestBody HazardCreateDTO dto) {
        return Result.success("隐患录入成功", hazardService.createHazard(dto));
    }

    @Operation(summary = "查询隐患详情")
    @GetMapping("/{id}")
    public Result<HazardRecord> getHazard(@PathVariable Long id) {
        return Result.success(hazardService.getHazardById(id));
    }

    @Operation(summary = "分页查询隐患列表")
    @PostMapping("/page")
    public Result<PageResult<HazardRecord>> queryHazards(@RequestBody HazardQueryDTO dto) {
        return Result.success(hazardService.queryHazards(dto));
    }

    @Operation(summary = "提交整改信息")
    @PostMapping("/rectify")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'USE_UNIT')")
    public Result<HazardRecord> rectifyHazard(@Valid @RequestBody HazardRectifyDTO dto) {
        return Result.success("整改提交成功", hazardService.rectifyHazard(dto));
    }

    @Operation(summary = "复查验收")
    @PostMapping("/review")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<HazardRecord> reviewHazard(@Valid @RequestBody HazardReviewDTO dto) {
        return Result.success("复查完成", hazardService.reviewHazard(dto));
    }

    @Operation(summary = "升级督办")
    @PostMapping("/{id}/escalate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<Void> escalateHazard(@PathVariable Long id) {
        hazardService.escalateHazard(id);
        return Result.success("督办升级成功");
    }

    @Operation(summary = "获取逾期未整改隐患列表")
    @GetMapping("/overdue")
    public Result<List<HazardRecord>> getOverdueHazards() {
        return Result.success(hazardService.getOverdueHazards());
    }
}
