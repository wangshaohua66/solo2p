package com.notarization.controller;

import com.notarization.dto.ApiResponse;
import com.notarization.dto.request.VerifyCertificateRequest;
import com.notarization.dto.request.BatchVerifyRequest;
import com.notarization.service.CertificateVerificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@Validated
@RequiredArgsConstructor
public class CertificateController {

    private final CertificateVerificationService certificateVerificationService;

    @PostMapping("/certificate/verify")
    public ApiResponse<Map<String, Object>> verifyCertificate(@RequestBody @Valid VerifyCertificateRequest request) {
        Map<String, Object> result = certificateVerificationService.verifyCertificate(request.getVerificationCode());
        return ApiResponse.success(result);
    }

    @PostMapping("/certificate/batch-verify")
    public ApiResponse<List<Map<String, Object>>> batchVerify(@RequestBody @Valid BatchVerifyRequest request) {
        List<Map<String, Object>> result = certificateVerificationService.batchVerify(request.getVerificationCodes());
        return ApiResponse.success(result);
    }
}
