package com.talentmarket.gateway.controller;

import com.talentmarket.common.result.Result;
import com.talentmarket.gateway.service.CrossCenterDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/gateway")
@RequiredArgsConstructor
public class CrossCenterController {

    private final CrossCenterDataService crossCenterDataService;

    @PostMapping("/centers/register")
    public Result<Void> registerCenter(@RequestBody CrossCenterDataService.CenterInfo centerInfo) {
        crossCenterDataService.registerCenter(centerInfo);
        return Result.success();
    }

    @PostMapping("/centers/heartbeat")
    public Result<Void> heartbeat(@RequestParam String centerId) {
        crossCenterDataService.heartbeat(centerId);
        return Result.success();
    }

    @GetMapping("/centers")
    public Result<List<CrossCenterDataService.CenterInfo>> getAllCenters() {
        return Result.success(crossCenterDataService.getAllActiveCenters());
    }

    @GetMapping("/aggregate/{dataType}")
    public Mono<Result<CrossCenterDataService.AggregatedData>> aggregateData(
            @PathVariable String dataType,
            @RequestParam(required = false) Map<String, String> queryParams) {
        return crossCenterDataService.fetchCrossCenterData(dataType, queryParams)
                .map(Result::success)
                .onErrorResume(e -> {
                    log.error("跨中心聚合查询失败: {}", e.getMessage());
                    return Mono.just(Result.error("聚合查询失败: " + e.getMessage()));
                });
    }

    @PostMapping("/sync/broadcast")
    public Result<Void> broadcastSync(
            @RequestParam String sourceCenterId,
            @RequestParam String dataType,
            @RequestParam String dataId,
            @RequestBody Map<String, Object> data,
            @RequestParam(defaultValue = "UPDATE") CrossCenterDataService.OperationType operation) {
        crossCenterDataService.syncDataToOtherCenters(sourceCenterId, dataType, dataId, data, operation);
        return Result.success();
    }

    @PostMapping("/sync/enterprise-verify")
    public Result<Void> broadcastEnterpriseVerify(
            @RequestParam String centerId,
            @RequestParam Long enterpriseId,
            @RequestParam boolean passed,
            @RequestParam String message) {
        crossCenterDataService.broadcastEnterpriseVerifyResult(centerId, enterpriseId, passed, message);
        return Result.success();
    }

    @PostMapping("/sync/job-published")
    public Result<Void> broadcastJobPublished(
            @RequestParam String centerId,
            @RequestParam Long jobId,
            @RequestBody Map<String, Object> jobData) {
        crossCenterDataService.broadcastJobPublished(centerId, jobId, jobData);
        return Result.success();
    }

    @PostMapping("/sync/fair-updated")
    public Result<Void> broadcastFairUpdated(
            @RequestParam String centerId,
            @RequestParam Long fairId,
            @RequestBody Map<String, Object> fairData) {
        crossCenterDataService.broadcastFairUpdated(centerId, fairId, fairData);
        return Result.success();
    }
}
