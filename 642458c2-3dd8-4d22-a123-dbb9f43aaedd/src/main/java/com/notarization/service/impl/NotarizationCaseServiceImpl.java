package com.notarization.service.impl;

import com.notarization.dto.request.NotarizationApplyRequest;
import com.notarization.dto.request.WorkflowActionRequest;
import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.NotarizationCase;
import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import com.notarization.repository.NotarizationRepository;
import com.notarization.service.AccessControlService;
import com.notarization.service.NotarizationCaseService;
import com.notarization.service.WorkflowEngine;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.data.mongodb.core.query.TextQuery;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotarizationCaseServiceImpl implements NotarizationCaseService {

    private final WorkflowEngine workflowEngine;
    private final AccessControlService accessControlService;
    private final NotarizationRepository notarizationRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public NotarizationCase submitApplication(NotarizationApplyRequest req) {
        return workflowEngine.createCase(req);
    }

    @Override
    public NotarizationCase performWorkflow(String caseId, WorkflowActionRequest req) {
        NotarizationCase notarizationCase = notarizationRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CASE_NOT_FOUND));

        if (NotarizationType.WILL.equals(notarizationCase.getCaseType())) {
            accessControlService.checkWillAccess(caseId, req.getOperatorId());
        }

        return workflowEngine.transitionCase(caseId, req);
    }

    @Override
    public Page<NotarizationCase> searchCases(String keyword, CaseStatus status, NotarizationType type, HallId hallId, String notaryId, Pageable pageable) {
        List<Criteria> criteriaList = new ArrayList<>();

        if (status != null) {
            criteriaList.add(Criteria.where("status").is(status));
        }
        if (type != null) {
            criteriaList.add(Criteria.where("caseType").is(type));
        }
        if (hallId != null) {
            criteriaList.add(Criteria.where("hallId").is(hallId));
        }
        if (notaryId != null && !notaryId.isEmpty()) {
            criteriaList.add(Criteria.where("assignedNotaryId").is(notaryId));
        }

        Query query;
        if (keyword != null && !keyword.isEmpty()) {
            TextCriteria textCriteria = TextCriteria.forDefaultLanguage().matchingAny(keyword);
            query = TextQuery.queryText(textCriteria);
            if (!criteriaList.isEmpty()) {
                query.addCriteria(new Criteria().andOperator(criteriaList));
            }
        } else {
            query = new Query();
            if (!criteriaList.isEmpty()) {
                query.addCriteria(new Criteria().andOperator(criteriaList));
            }
        }

        long total = mongoTemplate.count(query, NotarizationCase.class);

        query.with(pageable);
        List<NotarizationCase> cases = mongoTemplate.find(query, NotarizationCase.class);

        return new PageImpl<>(cases, pageable, total);
    }

    @Override
    public NotarizationCase getCaseDetail(String caseId, String currentUserId) {
        NotarizationCase notarizationCase = notarizationRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CASE_NOT_FOUND));

        if (NotarizationType.WILL.equals(notarizationCase.getCaseType())) {
            accessControlService.checkWillAccess(caseId, currentUserId);
        }

        return notarizationCase;
    }

    @Override
    public Page<NotarizationCase> getMyCases(String notaryId, CaseStatus status, Pageable pageable) {
        List<Criteria> criteriaList = new ArrayList<>();
        criteriaList.add(Criteria.where("assignedNotaryId").is(notaryId));

        if (status != null) {
            criteriaList.add(Criteria.where("status").is(status));
        }

        Query query = new Query();
        query.addCriteria(new Criteria().andOperator(criteriaList));

        long total = mongoTemplate.count(query, NotarizationCase.class);

        query.with(pageable);
        List<NotarizationCase> cases = mongoTemplate.find(query, NotarizationCase.class);

        return new PageImpl<>(cases, pageable, total);
    }
}
