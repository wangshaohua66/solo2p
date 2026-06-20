package com.mw.registration.controller;

import com.mw.common.response.ApiResponse;
import com.mw.registration.document.ElectronicManifest;
import com.mw.registration.dto.ManifestOperateRequest;
import com.mw.registration.service.ManifestService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Tag(name = "电子联单", description = "联单生成、查询、作废、补录、PDF下载")
@RestController
@RequestMapping("/registration/manifest")
@RequiredArgsConstructor
public class ManifestController {

    private final ManifestService manifestService;

    @Operation(summary = "按联单号查询电子联单")
    @GetMapping("/{manifestNo}")
    public ApiResponse<ElectronicManifest> get(@PathVariable String manifestNo) {
        return ApiResponse.success(manifestService.getByNo(manifestNo));
    }

    @Operation(summary = "联单作废")
    @PostMapping("/void")
    public ApiResponse<ElectronicManifest> voidManifest(@Valid @RequestBody ManifestOperateRequest request) {
        return ApiResponse.success(manifestService.voidManifest(request.getManifestNo(), request.getRemark()));
    }

    @Operation(summary = "联单补录/变更（追加追溯编码）")
    @PostMapping("/amend")
    public ApiResponse<ElectronicManifest> amend(@RequestParam String manifestNo,
                                                  @RequestParam List<String> traceCodes,
                                                  @RequestParam(required = false) String remark) {
        return ApiResponse.success(manifestService.amendManifest(manifestNo, traceCodes, remark));
    }

    @Operation(summary = "下载电子联单PDF")
    @GetMapping("/{manifestNo}/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String manifestNo) {
        byte[] pdf = manifestService.downloadPdf(manifestNo);
        String fileName = URLEncoder.encode("联单_" + manifestNo + ".pdf", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + fileName)
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
