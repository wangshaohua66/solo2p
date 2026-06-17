package com.heritage.trace.controller;

import com.heritage.trace.common.Result;
import com.heritage.trace.entity.TraceRecord;
import com.heritage.trace.enums.FlowType;
import com.heritage.trace.service.TraceService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/trace")
@RequiredArgsConstructor
public class TraceController {

    private final TraceService traceService;

    @PostMapping
    public Result<TraceRecord> createRecord(@RequestBody TraceRecord record) {
        return Result.success(traceService.createRecord(record));
    }

    @GetMapping("/{id}")
    public Result<TraceRecord> getRecordById(@PathVariable String id) {
        return Result.success(traceService.getRecordById(id));
    }

    @GetMapping("/artifact/{artifactId}")
    public Result<List<TraceRecord>> getTraceChain(@PathVariable String artifactId) {
        return Result.success(traceService.getTraceChain(artifactId));
    }

    @GetMapping("/code/{artifactCode}")
    public Result<List<TraceRecord>> getTraceChainByCode(@PathVariable String artifactCode) {
        return Result.success(traceService.getTraceChainByCode(artifactCode));
    }

    @GetMapping("/artifact/{artifactId}/page")
    public Result<Page<TraceRecord>> getRecordsByArtifactId(
            @PathVariable String artifactId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(traceService.getRecordsByArtifactId(artifactId,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @GetMapping("/type/{flowType}")
    public Result<Page<TraceRecord>> getRecordsByFlowType(
            @PathVariable FlowType flowType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(traceService.getRecordsByFlowType(flowType,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @GetMapping("/range")
    public Result<List<TraceRecord>> getRecordsByTimeRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return Result.success(traceService.getRecordsByTimeRange(start, end));
    }

    @GetMapping("/verify/{artifactId}")
    public Result<Boolean> verifyChain(@PathVariable String artifactId) {
        return Result.success(traceService.verifyChain(artifactId));
    }

    @GetMapping("/stats")
    public Result<Map<String, Object>> getTraceStats() {
        return Result.success(traceService.getTraceStats());
    }
}
