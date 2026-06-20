package com.mw.registration.controller;

import com.mw.common.response.ApiResponse;
import com.mw.common.response.PageResult;
import com.mw.registration.document.WasteRecord;
import com.mw.registration.dto.BatchWasteRegistrationRequest;
import com.mw.registration.dto.WasteRegistrationResultDTO;
import com.mw.registration.service.AttachmentService;
import com.mw.registration.service.WasteRegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "废物登记", description = "批量登记、追溯编码、附件上传")
@RestController
@RequestMapping("/registration/waste")
@RequiredArgsConstructor
public class WasteRegistrationController {

    private final WasteRegistrationService wasteRegistrationService;
    private final AttachmentService attachmentService;

    @Operation(summary = "医疗机构批量上传废物产生记录")
    @PostMapping("/batch")
    public ApiResponse<WasteRegistrationResultDTO> batchRegister(@Valid @RequestBody BatchWasteRegistrationRequest request) {
        return ApiResponse.success(wasteRegistrationService.batchRegister(request));
    }

    @Operation(summary = "按追溯编码查询登记记录")
    @GetMapping("/{traceCode}")
    public ApiResponse<WasteRecord> getByTraceCode(@PathVariable String traceCode) {
        return ApiResponse.success(wasteRegistrationService.getByTraceCode(traceCode));
    }

    @Operation(summary = "分页查询机构废物登记记录")
    @GetMapping("/page")
    public ApiResponse<PageResult<WasteRecord>> page(
            @RequestParam(required = false) String orgId,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(wasteRegistrationService.pageByOrg(orgId, category, page, size));
    }

    @Operation(summary = "上传暂存状态照片附件")
    @PostMapping(value = "/attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<String> uploadAttachment(@RequestParam("file") MultipartFile file) {
        return ApiResponse.success(attachmentService.upload(file));
    }
}
