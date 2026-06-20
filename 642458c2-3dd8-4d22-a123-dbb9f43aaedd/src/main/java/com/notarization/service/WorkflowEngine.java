package com.notarization.service;

import com.notarization.dto.request.NotarizationApplyRequest;
import com.notarization.dto.request.WorkflowActionRequest;
import com.notarization.model.NotarizationCase;
import com.notarization.model.enums.CaseStatus;

public interface WorkflowEngine {

    NotarizationCase createCase(NotarizationApplyRequest req);

    NotarizationCase transitionCase(String caseId, WorkflowActionRequest req);

    CaseStatus getCaseStatus(String caseId);

    void autoReassignUnclaimed();
}
