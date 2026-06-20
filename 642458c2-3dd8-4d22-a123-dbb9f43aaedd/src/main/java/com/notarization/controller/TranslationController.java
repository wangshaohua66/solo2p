package com.notarization.controller;

import com.notarization.dto.ApiResponse;
import com.notarization.dto.PageResponse;
import com.notarization.dto.request.TranslationSubmitRequest;
import com.notarization.model.TranslationRecord;
import com.notarization.service.TranslationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Validated
@RequiredArgsConstructor
public class TranslationController {

    private final TranslationService translationService;

    @PostMapping("/translation/assign")
    public ApiResponse<TranslationRecord> assignTranslationTask(
            @RequestParam String caseId,
            @RequestParam String materialId,
            @RequestParam String sourceLang,
            @RequestParam String targetLang,
            @RequestParam String requesterId) {
        TranslationRecord result = translationService.assignTranslationTask(
                caseId, materialId, sourceLang, targetLang, requesterId);
        return ApiResponse.success(result);
    }

    @PostMapping("/translation/submit")
    public ApiResponse<TranslationRecord> submitTranslation(@RequestBody @Valid TranslationSubmitRequest request) {
        TranslationRecord result = translationService.submitTranslation(request);
        return ApiResponse.success(result);
    }

    @PutMapping("/translation/{translationId}/review")
    public ApiResponse<TranslationRecord> reviewTranslation(
            @PathVariable String translationId,
            @RequestParam String reviewerId,
            @RequestParam boolean passed,
            @RequestParam(required = false) String comment) {
        TranslationRecord result = translationService.reviewTranslation(
                translationId, reviewerId, passed, comment);
        return ApiResponse.success(result);
    }

    @GetMapping("/translation/case/{caseId}")
    public ApiResponse<List<TranslationRecord>> getByCaseId(@PathVariable String caseId) {
        List<TranslationRecord> records = translationService.getByCaseId(caseId);
        return ApiResponse.success(records);
    }

    @GetMapping("/translation/history/{associateId}")
    public ApiResponse<List<TranslationRecord>> getVersionHistory(@PathVariable String associateId) {
        List<TranslationRecord> history = translationService.getVersionHistory(associateId);
        return ApiResponse.success(history);
    }

    @GetMapping("/translation/pending-reviews")
    public ApiResponse<PageResponse<TranslationRecord>> getPendingReviews(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<TranslationRecord> resultPage = translationService.getPendingReviews(pageable);
        PageResponse<TranslationRecord> pageResponse = PageResponse.of(
                resultPage.getContent(),
                resultPage.getTotalElements(),
                page,
                size
        );
        return ApiResponse.success(pageResponse);
    }
}
