package com.notarization.controller;

import com.notarization.dto.ApiResponse;
import com.notarization.dto.PageResponse;
import com.notarization.dto.CaseSearchRequest;
import com.notarization.dto.request.NotarizationApplyRequest;
import com.notarization.dto.request.WorkflowActionRequest;
import com.notarization.dto.request.CrossHallAccessRequest;
import com.notarization.model.NotarizationCase;
import com.notarization.model.AccessRequest;
import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.NotarizationType;
import com.notarization.model.enums.HallId;
import com.notarization.security.annotation.WillAccessRestricted;
import com.notarization.service.NotarizationCaseService;
import com.notarization.service.AccessControlService;
import com.notarization.security.AuthService;
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
public class NotarizationController {

    private final NotarizationCaseService notarizationCaseService;
    private final AccessControlService accessControlService;
    private final AuthService authService;

    @PostMapping("/notarization/apply")
    public ApiResponse<NotarizationCase> submitApplication(@RequestBody @Valid NotarizationApplyRequest request) {
        NotarizationCase result = notarizationCaseService.submitApplication(request);
        return ApiResponse.success(result);
    }

    @PostMapping("/notarization/{caseId}/workflow")
    @WillAccessRestricted
    public ApiResponse<NotarizationCase> performWorkflow(@PathVariable String caseId,
                                                         @RequestBody @Valid WorkflowActionRequest request) {
        NotarizationCase result = notarizationCaseService.performWorkflow(caseId, request);
        return ApiResponse.success(result);
    }

    @GetMapping("/notarization/search")
    public ApiResponse<PageResponse<NotarizationCase>> searchCases(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) CaseStatus status,
            @RequestParam(required = false) HallId hallId,
            @RequestParam(required = false) NotarizationType caseType,
            @RequestParam(required = false) String notaryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        CaseSearchRequest searchRequest = CaseSearchRequest.builder()
                .keyword(keyword)
                .status(status)
                .hallId(hallId)
                .caseType(caseType)
                .notaryId(notaryId)
                .build();
        Page<NotarizationCase> resultPage = notarizationCaseService.searchCases(searchRequest, pageable);
        PageResponse<NotarizationCase> pageResponse = PageResponse.of(
                resultPage.getContent(),
                resultPage.getTotalElements(),
                page,
                size
        );
        return ApiResponse.success(pageResponse);
    }

    @GetMapping("/notarization/{caseId}")
    @WillAccessRestricted
    public ApiResponse<NotarizationCase> getCaseDetail(@PathVariable String caseId) {
        String currentUserId = authService.getCurrentUser().getId();
        NotarizationCase result = notarizationCaseService.getCaseDetail(caseId, currentUserId);
        return ApiResponse.success(result);
    }

    @GetMapping("/notarization/my-cases")
    @WillAccessRestricted
    public ApiResponse<PageResponse<NotarizationCase>> getMyCases(
            @RequestParam(required = false) CaseStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String notaryId = authService.getCurrentUser().getId();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<NotarizationCase> resultPage = notarizationCaseService.getMyCases(notaryId, status, pageable);
        PageResponse<NotarizationCase> pageResponse = PageResponse.of(
                resultPage.getContent(),
                resultPage.getTotalElements(),
                page,
                size
        );
        return ApiResponse.success(pageResponse);
    }

    @GetMapping("/notarization/{caseId}/status")
    public ApiResponse<CaseStatus> getCaseStatus(@PathVariable String caseId) {
        CaseStatus status = notarizationCaseService.getCaseStatus(caseId);
        return ApiResponse.success(status);
    }

    @PostMapping("/notarization/cross-hall/request")
    public ApiResponse<AccessRequest> requestCrossHallAccess(@RequestBody @Valid CrossHallAccessRequest request) {
        AccessRequest result = accessControlService.requestCrossHallAccess(request);
        return ApiResponse.success(result);
    }

    @PutMapping("/notarization/cross-hall/{requestId}/approve")
    public ApiResponse<AccessRequest> approveAccess(@PathVariable String requestId,
                                                    @RequestParam boolean approved,
                                                    @RequestParam String approverId) {
        AccessRequest result = accessControlService.approveAccess(requestId, approved, approverId);
        return ApiResponse.success(result);
    }

    @GetMapping("/notarization/cross-hall/pending")
    public ApiResponse<PageResponse<AccessRequest>> getPendingRequests(
            @RequestParam HallId hallId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "requestTime"));
        Page<AccessRequest> resultPage = accessControlService.getPendingRequests(hallId, pageable);
        PageResponse<AccessRequest> pageResponse = PageResponse.of(
                resultPage.getContent(),
                resultPage.getTotalElements(),
                page,
                size
        );
        return ApiResponse.success(pageResponse);
    }

    @GetMapping("/notarization/cross-hall/my-requests")
    public ApiResponse<PageResponse<AccessRequest>> getMyRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String userId = authService.getCurrentUser().getId();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "requestTime"));
        Page<AccessRequest> resultPage = accessControlService.getMyRequests(userId, pageable);
        PageResponse<AccessRequest> pageResponse = PageResponse.of(
                resultPage.getContent(),
                resultPage.getTotalElements(),
                page,
                size
        );
        return ApiResponse.success(pageResponse);
    }
}
