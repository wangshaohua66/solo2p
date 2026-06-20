package com.notarization.service;

import com.notarization.dto.ApiResponse;

import java.util.List;
import java.util.Map;

public interface CertificateVerificationService {

    ApiResponse<Map<String, Object>> verifyCertificate(String verificationCode);

    ApiResponse<List<Map<String, Object>>> batchVerify(List<String> codes);
}
