package com.tvstation.media.controller;

import com.tvstation.media.common.ApiResponse;
import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Copyright;
import com.tvstation.media.service.CopyrightService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/copyrights")
@RequiredArgsConstructor
@Tag(name = "版权管理", description = "版权资产与侵权风险管理接口")
public class CopyrightController {

    private final CopyrightService copyrightService;

    @GetMapping
    @Operation(summary = "获取版权列表")
    public ApiResponse<PageResult<Copyright>> getCopyrights(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Copyright.CopyrightStatus status,
            @RequestParam(required = false) String keyword) {
        PageResult<Copyright> result = copyrightService.getCopyrights(status, keyword, page, pageSize);
        return ApiResponse.success(result, result.getTotal());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取版权详情")
    public ApiResponse<Copyright> getCopyrightDetail(@PathVariable Long id) {
        return ApiResponse.success(copyrightService.getCopyrightById(id));
    }

    @PostMapping
    @Operation(summary = "创建版权")
    public ApiResponse<Copyright> createCopyright(
            @RequestBody Copyright copyright,
            @RequestHeader("userId") Long userId,
            @RequestHeader("userName") String userName) {
        Copyright created = copyrightService.createCopyright(copyright, userId, userName);
        return ApiResponse.success("版权创建成功", created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新版权")
    public ApiResponse<Copyright> updateCopyright(
            @PathVariable Long id,
            @RequestBody Copyright copyright,
            @RequestHeader("userId") Long userId) {
        Copyright updated = copyrightService.updateCopyright(id, copyright, userId);
        return ApiResponse.success("更新成功", updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除版权")
    public ApiResponse<Void> deleteCopyright(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        copyrightService.deleteCopyright(id, userId);
        return ApiResponse.success("删除成功", null);
    }

    @GetMapping("/expiring")
    @Operation(summary = "获取即将到期版权")
    public ApiResponse<List<Copyright>> getExpiringCopyrights(@RequestParam(defaultValue = "7") int days) {
        return ApiResponse.success(copyrightService.getExpiringCopyrights(days));
    }

    @GetMapping("/stats")
    @Operation(summary = "版权统计")
    public ApiResponse<Map<String, Object>> getCopyrightStats() {
        return ApiResponse.success(copyrightService.getCopyrightStats());
    }

    @PostMapping("/{id}/assess-risk")
    @Operation(summary = "评估单个版权侵权风险")
    public ApiResponse<Copyright> assessRisk(@PathVariable Long id) {
        return ApiResponse.success(copyrightService.assessRisk(id));
    }

    @PostMapping("/assess-all-risks")
    @Operation(summary = "批量评估所有版权风险")
    public ApiResponse<List<Copyright>> assessAllRisks() {
        return ApiResponse.success(copyrightService.assessAllRisks());
    }

    @GetMapping("/high-risk")
    @Operation(summary = "获取高风险版权列表")
    public ApiResponse<List<Copyright>> getHighRiskCopyrights() {
        return ApiResponse.success(copyrightService.getHighRiskCopyrights());
    }

    @GetMapping("/risk-stats")
    @Operation(summary = "获取侵权风险统计")
    public ApiResponse<Map<String, Object>> getRiskStatistics() {
        return ApiResponse.success(copyrightService.getRiskStatistics());
    }
}
