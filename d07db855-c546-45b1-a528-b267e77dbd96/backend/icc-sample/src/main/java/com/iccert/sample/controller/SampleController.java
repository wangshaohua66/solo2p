package com.iccert.sample.controller;

import com.iccert.common.page.PageQuery;
import com.iccert.common.page.PageResult;
import com.iccert.common.result.R;
import com.iccert.sample.entity.SampleFlowLog;
import com.iccert.sample.entity.SampleInfo;
import com.iccert.sample.service.FileStorageService;
import com.iccert.sample.service.SampleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Tag(name = "样品管理", description = "样品登记、批量导入、拍照上传、留样管理")
@RestController
@RequestMapping
@RequiredArgsConstructor
public class SampleController {

    private final SampleService sampleService;
    private final FileStorageService fileStorageService;

    @Operation(summary = "分页查询样品列表")
    @GetMapping("/list")
    public R<PageResult<SampleInfo>> page(PageQuery query,
                                          @RequestParam(required = false) String status) {
        return R.ok(sampleService.page(query, status));
    }

    @Operation(summary = "获取样品详情")
    @GetMapping("/{id}")
    public R<SampleInfo> getById(@PathVariable Long id) {
        return R.ok(sampleService.getById(id));
    }

    @Operation(summary = "新增样品登记")
    @PostMapping
    public R<SampleInfo> create(@RequestBody SampleInfo sample, HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        sample.setCreateBy(userId);
        sample.setReceiverId(userId);
        sample.setReceiverName(username);
        return R.ok(sampleService.create(sample));
    }

    @Operation(summary = "批量Excel导入样品")
    @PostMapping("/import")
    public R<Map<String, Object>> batchImport(@RequestParam("file") MultipartFile file,
                                              HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(sampleService.batchImportExcel(file, userId, username));
    }

    @Operation(summary = "拍照上传/文件上传样品图片")
    @PostMapping("/photo/upload")
    public R<List<Map<String, Object>>> uploadPhotos(@RequestParam("file") MultipartFile[] files,
                                                     @RequestParam Long sampleId,
                                                     HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        return R.ok(fileStorageService.uploadPhotos(files, sampleId, userId));
    }

    @Operation(summary = "更新样品状态")
    @PutMapping("/{id}/status")
    public R<Boolean> updateStatus(@PathVariable Long id,
                                   @RequestParam String status,
                                   @RequestParam(required = false) String remark,
                                   HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(sampleService.updateStatus(id, status, userId, username, remark));
    }

    @Operation(summary = "留样销毁")
    @PostMapping("/{id}/destroy")
    public R<Boolean> destroy(@PathVariable Long id,
                              @RequestParam(required = false) String remark,
                              HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(sampleService.destroySample(id, userId, username, remark));
    }

    @Operation(summary = "查询即将到期留样列表")
    @GetMapping("/retention/expiring")
    public R<List<SampleInfo>> getExpiringRetention() {
        return R.ok(sampleService.getExpiringRetentionSamples());
    }

    @Operation(summary = "查询样品流转记录")
    @GetMapping("/{id}/flow-logs")
    public R<List<SampleFlowLog>> getFlowLogs(@PathVariable Long id) {
        return R.ok(sampleService.listFlowLogs(id));
    }
}
