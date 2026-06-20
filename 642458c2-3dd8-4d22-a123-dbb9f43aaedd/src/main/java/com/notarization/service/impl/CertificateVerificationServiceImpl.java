package com.notarization.service.impl;

import com.notarization.dto.ApiResponse;
import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.NotarizationCase;
import com.notarization.model.enums.CaseStatus;
import com.notarization.repository.NotarizationRepository;
import com.notarization.service.CertificateVerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CertificateVerificationServiceImpl implements CertificateVerificationService {

    private final NotarizationRepository notarizationRepository;

    @Override
    public ApiResponse<Map<String, Object>> verifyCertificate(String verificationCode) {
        Optional<NotarizationCase> caseOpt = notarizationRepository.findByVerificationCode(verificationCode);

        if (caseOpt.isEmpty()) {
            throw new BusinessException(ErrorCode.CERTIFICATE_INVALID);
        }

        NotarizationCase notarizationCase = caseOpt.get();
        Map<String, Object> result = buildCertificateInfo(notarizationCase);
        return ApiResponse.success(result);
    }

    @Override
    public ApiResponse<List<Map<String, Object>>> batchVerify(List<String> codes) {
        List<Map<String, Object>> results = new ArrayList<>();

        for (String code : codes) {
            Map<String, Object> item = new HashMap<>();
            item.put("code", code);

            try {
                Optional<NotarizationCase> caseOpt = notarizationRepository.findByVerificationCode(code);
                if (caseOpt.isPresent()) {
                    NotarizationCase notarizationCase = caseOpt.get();
                    Map<String, Object> info = buildCertificateInfo(notarizationCase);
                    item.put("valid", true);
                    item.put("errorMessage", null);
                    item.put("data", info);
                } else {
                    item.put("valid", false);
                    item.put("errorMessage", "公证书验证失败");
                    item.put("data", null);
                }
            } catch (Exception e) {
                item.put("valid", false);
                item.put("errorMessage", e.getMessage());
                item.put("data", null);
            }

            results.add(item);
        }

        return ApiResponse.success(results);
    }

    private Map<String, Object> buildCertificateInfo(NotarizationCase notarizationCase) {
        Map<String, Object> info = new HashMap<>();
        info.put("caseNumber", notarizationCase.getCaseNumber());
        info.put("caseType", notarizationCase.getCaseType() != null ? notarizationCase.getCaseType().name() : null);
        info.put("applicantName", maskName(notarizationCase.getApplicantName()));
        info.put("issueDate", extractCertifiedTime(notarizationCase));
        info.put("status", notarizationCase.getStatus() != null ? notarizationCase.getStatus().name() : null);
        return info;
    }

    private String maskName(String name) {
        if (name == null || name.isEmpty()) {
            return name;
        }

        int len = name.length();
        if (len <= 2) {
            return name.charAt(0) + "*";
        } else {
            StringBuilder sb = new StringBuilder();
            sb.append(name.charAt(0));
            for (int i = 0; i < len - 2; i++) {
                sb.append("*");
            }
            sb.append(name.charAt(len - 1));
            return sb.toString();
        }
    }

    private Instant extractCertifiedTime(NotarizationCase notarizationCase) {
        if (notarizationCase.getWorkflowHistory() == null) {
            return null;
        }

        for (NotarizationCase.WorkflowRecord record : notarizationCase.getWorkflowHistory()) {
            if (CaseStatus.CERTIFIED.equals(record.getStatusTo())) {
                return record.getTimestamp();
            }
        }

        return null;
    }
}
