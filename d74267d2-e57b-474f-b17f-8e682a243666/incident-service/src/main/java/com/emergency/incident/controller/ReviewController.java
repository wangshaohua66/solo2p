package com.emergency.incident.controller;

import com.emergency.common.dto.PageResult;
import com.emergency.common.result.Result;
import com.emergency.common.util.SecurityUtils;
import com.emergency.incident.dto.ArchiveIncidentRequest;
import com.emergency.incident.dto.CaseComparisonRequest;
import com.emergency.incident.dto.GenerateReviewRequest;
import com.emergency.incident.dto.HistoryCaseQueryRequest;
import com.emergency.incident.entity.*;
import com.emergency.incident.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/review")
@RequiredArgsConstructor
@Tag(name = "复盘分析管理", description = "灾情归档、复盘报告、历史案例、案例对比接口")
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping("/archive")
    @Operation(summary = "灾情归档", description = "将已结案的灾情进行归档处理")
    public Result<IncidentArchive> archiveIncident(@Valid @RequestBody ArchiveIncidentRequest request) {
        return Result.success(reviewService.archiveIncident(request));
    }

    @GetMapping("/archive/{id}")
    @Operation(summary = "获取归档详情")
    public Result<IncidentArchive> getArchiveById(@PathVariable Long id) {
        return Result.success(reviewService.getArchiveById(id));
    }

    @GetMapping("/archive/incident/{incidentId}")
    @Operation(summary = "获取灾情的归档记录列表")
    public Result<List<IncidentArchive>> getArchivesByIncidentId(@PathVariable Long incidentId) {
        return Result.success(reviewService.getArchivesByIncidentId(incidentId));
    }

    @PostMapping("/report/generate")
    @Operation(summary = "生成复盘报告", description = "基于归档数据自动生成复盘分析报告")
    public Result<IncidentReviewReport> generateReviewReport(@Valid @RequestBody GenerateReviewRequest request) {
        return Result.success(reviewService.generateReviewReport(request));
    }

    @GetMapping("/report/{id}")
    @Operation(summary = "获取复盘报告详情")
    public Result<IncidentReviewReport> getReviewReportById(@PathVariable Long id) {
        return Result.success(reviewService.getReviewReportById(id));
    }

    @GetMapping("/report/incident/{incidentId}")
    @Operation(summary = "获取灾情的复盘报告列表")
    public Result<List<IncidentReviewReport>> getReviewReportsByIncidentId(@PathVariable Long incidentId) {
        return Result.success(reviewService.getReviewReportsByIncidentId(incidentId));
    }

    @PutMapping("/report/{id}/approve")
    @Operation(summary = "审核复盘报告", description = "审核通过后自动生成历史案例")
    public Result<IncidentReviewReport> approveReviewReport(
            @PathVariable Long id,
            @Parameter(description = "审核备注") @RequestParam(required = false) String reviewRemark) {
        Long reviewerId = SecurityUtils.getCurrentUserId();
        return Result.success(reviewService.approveReviewReport(id, reviewerId, reviewRemark));
    }

    @GetMapping("/case/{id}")
    @Operation(summary = "获取历史案例详情")
    public Result<IncidentHistoryCase> getHistoryCaseById(@PathVariable Long id) {
        return Result.success(reviewService.getHistoryCaseById(id));
    }

    @PostMapping("/case/query")
    @Operation(summary = "分页查询历史案例")
    public Result<PageResult<IncidentHistoryCase>> queryHistoryCases(@Valid @RequestBody HistoryCaseQueryRequest request) {
        return Result.success(reviewService.queryHistoryCases(request));
    }

    @GetMapping("/case/classic")
    @Operation(summary = "获取经典案例列表")
    public Result<List<IncidentHistoryCase>> getClassicCases() {
        return Result.success(reviewService.getClassicCases());
    }

    @GetMapping("/case/similar/{incidentId}")
    @Operation(summary = "查找相似案例", description = "根据灾情类型和级别查找相似的历史案例")
    public Result<List<IncidentHistoryCase>> findSimilarCases(
            @PathVariable Long incidentId,
            @Parameter(description = "返回数量") @RequestParam(defaultValue = "5") Integer limit) {
        return Result.success(reviewService.findSimilarCases(incidentId, limit));
    }

    @PostMapping("/comparison")
    @Operation(summary = "案例对比分析", description = "将当前灾情与历史案例进行对比分析")
    public Result<IncidentCaseComparison> compareWithCase(@Valid @RequestBody CaseComparisonRequest request) {
        return Result.success(reviewService.compareWithCase(request));
    }

    @GetMapping("/comparison/incident/{sourceIncidentId}")
    @Operation(summary = "获取灾情的案例对比列表")
    public Result<List<IncidentCaseComparison>> getComparisonsByIncidentId(@PathVariable Long sourceIncidentId) {
        return Result.success(reviewService.getComparisonsByIncidentId(sourceIncidentId));
    }

    @GetMapping("/timeline/{incidentId}")
    @Operation(summary = "生成时间轴分析", description = "生成灾情处置全流程时间轴分析")
    public Result<Map<String, Object>> generateTimelineAnalysis(@PathVariable Long incidentId) {
        return Result.success(reviewService.generateTimelineAnalysis(incidentId));
    }

    @GetMapping("/efficiency/{incidentId}")
    @Operation(summary = "计算效率指标", description = "计算灾情处置的效率指标和评分")
    public Result<Map<String, Object>> calculateEfficiencyMetrics(@PathVariable Long incidentId) {
        return Result.success(reviewService.calculateEfficiencyMetrics(incidentId));
    }

    @PostMapping("/auto-archive")
    @Operation(summary = "手动触发自动归档", description = "手动触发自动归档已结案超过7天的灾情")
    public Result<Void> triggerAutoArchive() {
        reviewService.autoArchiveCompletedIncidents();
        return Result.success();
    }
}
