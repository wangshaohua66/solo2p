package com.notarization.service;

import com.notarization.dto.request.NotarizationApplyRequest;
import com.notarization.dto.request.WorkflowActionRequest;
import com.notarization.model.NotarizationCase;
import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface NotarizationCaseService {

    NotarizationCase submitApplication(NotarizationApplyRequest req);

    NotarizationCase performWorkflow(String caseId, WorkflowActionRequest req);

    Page<NotarizationCase> searchCases(String keyword, CaseStatus status, NotarizationType type, HallId hallId, String notaryId, Pageable pageable);

    NotarizationCase getCaseDetail(String caseId, String currentUserId);

    Page<NotarizationCase> getMyCases(String notaryId, CaseStatus status, Pageable pageable);
}
