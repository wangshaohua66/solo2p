package com.mw.disposal.controller;

import com.mw.common.response.ApiResponse;
import com.mw.disposal.document.DisposalBatch;
import com.mw.disposal.dto.DisposalBatchCreateRequest;
import com.mw.disposal.dto.EmissionLinkRequest;
import com.mw.disposal.dto.ProcessDataRequest;
import com.mw.disposal.service.DisposalProcessService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "处置流程", description = "批次创建、工艺曲线、排放监测、达标判定")
@RestController
@RequestMapping("/disposal")
@RequiredArgsConstructor
public class DisposalController {

    private final DisposalProcessService disposalProcessService;

    @Operation(summary = "创建处置批次并关联入炉联单")
    @PostMapping("/batch")
    public ApiResponse<DisposalBatch> create(@Valid @RequestBody DisposalBatchCreateRequest request) {
        return ApiResponse.success(disposalProcessService.createBatch(request));
    }

    @Operation(summary = "记录温度/压力曲线与灭菌时长")
    @PutMapping("/batch/{batchNo}/process")
    public ApiResponse<DisposalBatch> recordProcess(@PathVariable String batchNo,
                                                    @Valid @RequestBody ProcessDataRequest request) {
        request.setBatchNo(batchNo);
        return ApiResponse.success(disposalProcessService.recordProcess(request));
    }

    @Operation(summary = "关联在线监测排放数据")
    @PutMapping("/batch/{batchNo}/emission")
    public ApiResponse<DisposalBatch> linkEmission(@PathVariable String batchNo,
                                                   @Valid @RequestBody EmissionLinkRequest request) {
        request.setBatchNo(batchNo);
        return ApiResponse.success(disposalProcessService.linkEmission(request));
    }

    @Operation(summary = "处置达标判定（不达标自动标记并推送复核）")
    @PostMapping("/batch/{batchNo}/evaluate")
    public ApiResponse<DisposalBatch> evaluate(@PathVariable String batchNo) {
        return ApiResponse.success(disposalProcessService.evaluateQualified(batchNo));
    }

    @Operation(summary = "查询处置批次详情")
    @GetMapping("/batch/{batchNo}")
    public ApiResponse<DisposalBatch> get(@PathVariable String batchNo) {
        return ApiResponse.success(disposalProcessService.getByBatchNo(batchNo));
    }
}
