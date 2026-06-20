package com.mw.trace.controller;

import com.mw.common.response.ApiResponse;
import com.mw.trace.dto.StatisticsRequest;
import com.mw.trace.dto.StatisticsResponse;
import com.mw.trace.dto.TraceTimeline;
import com.mw.trace.service.TraceQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Tag(name = "溯源查询", description = "全流程时间轴、聚合统计、Excel导出")
@RestController
@RequestMapping("/trace")
@RequiredArgsConstructor
public class TraceController {

    private final TraceQueryService traceQueryService;

    @Operation(summary = "按包装追溯码查询全流程时间轴")
    @GetMapping("/{traceCode}")
    public ApiResponse<TraceTimeline> queryByTraceCode(@PathVariable String traceCode) {
        return ApiResponse.success(traceQueryService.queryByTraceCode(traceCode));
    }

    @Operation(summary = "按电子联单号查询全流程时间轴")
    @GetMapping("/manifest/{manifestNo}")
    public ApiResponse<TraceTimeline> queryByManifestNo(@PathVariable String manifestNo) {
        return ApiResponse.success(traceQueryService.queryByManifestNo(manifestNo));
    }

    @Operation(summary = "统计分析（产生/收运/处置，同比环比）")
    @PostMapping("/statistics")
    public ApiResponse<StatisticsResponse> statistics(@Valid @RequestBody StatisticsRequest request) {
        return ApiResponse.success(traceQueryService.statistics(request));
    }

    @Operation(summary = "导出统计报表Excel")
    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@Valid @RequestBody StatisticsRequest request) {
        byte[] data = traceQueryService.exportExcel(request);
        String fileName = URLEncoder.encode("医疗废物统计报表.xlsx", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + fileName)
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}
