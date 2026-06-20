package com.notarization.controller;

import com.notarization.dto.ApiResponse;
import com.notarization.dto.PageResponse;
import com.notarization.dto.IntegrityVerifyResult;
import com.notarization.dto.request.EvidenceSubmitRequest;
import com.notarization.dto.request.EvidenceVerifyRequest;
import com.notarization.model.EvidenceRecord;
import com.notarization.model.HashChain;
import com.notarization.service.EvidenceHashService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Validated
@RequiredArgsConstructor
public class EvidenceController {

    private final EvidenceHashService evidenceHashService;

    @PostMapping("/evidence/submit")
    public ApiResponse<EvidenceRecord> submitEvidence(@RequestBody @Valid EvidenceSubmitRequest request) {
        EvidenceRecord result = evidenceHashService.submitEvidence(request);
        return ApiResponse.success(result);
    }

    @PostMapping("/evidence/verify")
    public ApiResponse<IntegrityVerifyResult> verifyIntegrity(@RequestBody @Valid EvidenceVerifyRequest request) {
        IntegrityVerifyResult result = evidenceHashService.verifyIntegrity(request.getEvidenceId());
        return ApiResponse.success(result);
    }

    @GetMapping("/evidence/{evidenceId}")
    public ApiResponse<EvidenceRecord> getEvidence(@PathVariable String evidenceId) {
        EvidenceRecord record = evidenceHashService.findByEvidenceNumber(evidenceId)
                .orElseGet(() -> evidenceHashService.findById(evidenceId).orElse(null));
        return ApiResponse.success(record);
    }

    @GetMapping("/evidence/chain/{chainId}")
    public ApiResponse<HashChain> getChain(@PathVariable String chainId) {
        HashChain chain = evidenceHashService.getChain(chainId);
        return ApiResponse.success(chain);
    }

    @GetMapping("/evidence/case/{caseId}")
    public ApiResponse<PageResponse<EvidenceRecord>> findByCaseId(
            @PathVariable String caseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<EvidenceRecord> resultPage = evidenceHashService.findByCaseId(caseId, pageable);
        PageResponse<EvidenceRecord> pageResponse = PageResponse.of(
                resultPage.getContent(),
                resultPage.getTotalElements(),
                page,
                size
        );
        return ApiResponse.success(pageResponse);
    }
}
