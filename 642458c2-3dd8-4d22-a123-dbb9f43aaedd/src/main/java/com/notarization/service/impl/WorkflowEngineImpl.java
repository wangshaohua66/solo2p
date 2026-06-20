package com.notarization.service.impl;

import com.notarization.dto.request.MaterialItem;
import com.notarization.dto.request.NotarizationApplyRequest;
import com.notarization.dto.request.WorkflowActionRequest;
import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.NotarizationCase;
import com.notarization.model.User;
import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import com.notarization.model.enums.UserRole;
import com.notarization.model.enums.WorkflowAction;
import com.notarization.repository.NotarizationRepository;
import com.notarization.repository.UserRepository;
import com.notarization.service.WorkflowEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@EnableScheduling
public class WorkflowEngineImpl implements WorkflowEngine {

    private static final Map<CaseStatus, Map<WorkflowAction, CaseStatus>> TRANSITIONS = new HashMap<>();
    private static final AtomicInteger dailyCounter = new AtomicInteger(0);
    private static String lastDatePrefix = "";

    static {
        Map<WorkflowAction, CaseStatus> acceptedTransitions = new HashMap<>();
        acceptedTransitions.put(WorkflowAction.START_REVIEW, CaseStatus.UNDER_REVIEW);
        acceptedTransitions.put(WorkflowAction.REQUEST_SUPPLEMENT, CaseStatus.SUPPLEMENT);
        TRANSITIONS.put(CaseStatus.ACCEPTED, acceptedTransitions);

        Map<WorkflowAction, CaseStatus> underReviewTransitions = new HashMap<>();
        underReviewTransitions.put(WorkflowAction.REQUEST_SUPPLEMENT, CaseStatus.SUPPLEMENT);
        underReviewTransitions.put(WorkflowAction.SUBMIT_APPROVAL, CaseStatus.APPROVING);
        underReviewTransitions.put(WorkflowAction.REJECT, CaseStatus.ACCEPTED);
        TRANSITIONS.put(CaseStatus.UNDER_REVIEW, underReviewTransitions);

        Map<WorkflowAction, CaseStatus> supplementTransitions = new HashMap<>();
        supplementTransitions.put(WorkflowAction.RESUBMIT, CaseStatus.UNDER_REVIEW);
        supplementTransitions.put(WorkflowAction.REJECT, CaseStatus.ACCEPTED);
        TRANSITIONS.put(CaseStatus.SUPPLEMENT, supplementTransitions);

        Map<WorkflowAction, CaseStatus> approvingTransitions = new HashMap<>();
        approvingTransitions.put(WorkflowAction.APPROVE, CaseStatus.CERTIFIED);
        approvingTransitions.put(WorkflowAction.REJECT, CaseStatus.UNDER_REVIEW);
        TRANSITIONS.put(CaseStatus.APPROVING, approvingTransitions);

        Map<WorkflowAction, CaseStatus> certifiedTransitions = new HashMap<>();
        certifiedTransitions.put(WorkflowAction.ARCHIVE, CaseStatus.ARCHIVED);
        TRANSITIONS.put(CaseStatus.CERTIFIED, certifiedTransitions);
    }

    private final NotarizationRepository notarizationRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public NotarizationCase createCase(NotarizationApplyRequest req) {
        HallId hallId = req.getHallId();
        NotarizationType caseType = req.getCaseType();

        NotarizationCase.NotarizationCaseBuilder builder = NotarizationCase.builder()
                .caseNumber(generateCaseNumber())
                .caseType(caseType)
                .applicantName(req.getApplicantName())
                .applicantIdCard(req.getApplicantIdCard())
                .contactPhone(req.getContactPhone())
                .hallId(hallId)
                .urgent(req.getUrgent() != null ? req.getUrgent() : false)
                .status(CaseStatus.ACCEPTED);

        List<NotarizationCase.Material> materials = new ArrayList<>();
        if (req.getMaterials() != null) {
            for (MaterialItem item : req.getMaterials()) {
                materials.add(NotarizationCase.Material.builder()
                        .id(UUID.randomUUID().toString())
                        .name(item.getMaterialName())
                        .url(item.getFileUrl())
                        .type(item.getFileType())
                        .size(item.getFileSize())
                        .hash(item.getHash())
                        .uploaderId(req.getApplicantIdCard())
                        .uploadTime(Instant.now())
                        .build());
            }
        }
        builder.materials(materials);

        List<User> availableNotaries = userRepository.findByRoleAndAvailableAndHallId(
                UserRole.NOTARY, true, hallId);
        String assignedNotaryId = null;
        if (!availableNotaries.isEmpty()) {
            assignedNotaryId = availableNotaries.get(0).getId();
            builder.assignedNotaryId(assignedNotaryId);
        }

        if (caseType == NotarizationType.WILL) {
            List<String> allowedUserIds = new ArrayList<>();
            if (assignedNotaryId != null) {
                allowedUserIds.add(assignedNotaryId);
            }
            List<User> admins = userRepository.findByRole(UserRole.ADMIN, org.springframework.data.domain.Pageable.unpaged()).getContent();
            allowedUserIds.addAll(admins.stream().map(User::getId).collect(Collectors.toList()));
            builder.accessControl(NotarizationCase.AccessControl.builder()
                    .allowedUserIds(allowedUserIds)
                    .isRestricted(true)
                    .build());
        }

        List<NotarizationCase.WorkflowRecord> workflowHistory = new ArrayList<>();
        workflowHistory.add(NotarizationCase.WorkflowRecord.builder()
                .statusFrom(CaseStatus.ACCEPTED)
                .statusTo(CaseStatus.ACCEPTED)
                .action(WorkflowAction.ACCEPT)
                .operatorId(req.getApplicantIdCard())
                .operatorName(req.getApplicantName())
                .opinion("案件创建")
                .timestamp(Instant.now())
                .build());
        builder.workflowHistory(workflowHistory);

        builder.approvalRecords(new ArrayList<>());

        NotarizationCase notarizationCase = builder.build();
        return notarizationRepository.save(notarizationCase);
    }

    @Override
    @Transactional
    public NotarizationCase transitionCase(String caseId, WorkflowActionRequest req) {
        NotarizationCase notarizationCase = notarizationRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CASE_NOT_FOUND));

        CaseStatus currentStatus = notarizationCase.getStatus();
        WorkflowAction action = req.getAction();

        Map<WorkflowAction, CaseStatus> allowedTransitions = TRANSITIONS.get(currentStatus);
        if (allowedTransitions == null || !allowedTransitions.containsKey(action)) {
            throw new BusinessException(ErrorCode.WORKFLOW_INVALID);
        }

        CaseStatus targetStatus = allowedTransitions.get(action);

        String opinion = req.getOpinion();
        Boolean urgentFlag = req.getUrgent() != null ? req.getUrgent() : notarizationCase.getUrgent();
        if (urgentFlag != null && urgentFlag) {
            opinion = (opinion == null ? "" : opinion) + " [加急通道时长减半]";
        }

        if (targetStatus == CaseStatus.CERTIFIED) {
            notarizationCase.setVerificationCode(
                    UUID.randomUUID().toString().replace("-", "").toUpperCase());
        }

        if (targetStatus == CaseStatus.APPROVING && notarizationCase.getAssignedReviewerId() == null) {
            List<User> availableReviewers = userRepository.findByRoleAndAvailableAndHallId(
                    UserRole.REVIEWER, true, notarizationCase.getHallId());
            if (!availableReviewers.isEmpty()) {
                notarizationCase.setAssignedReviewerId(availableReviewers.get(0).getId());
            }
        }

        String operatorName = req.getOperatorName();
        if (operatorName == null || operatorName.isEmpty()) {
            Optional<User> operatorOpt = userRepository.findById(req.getOperatorId());
            if (operatorOpt.isPresent()) {
                operatorName = operatorOpt.get().getRealName();
            }
        }

        NotarizationCase.WorkflowRecord record = NotarizationCase.WorkflowRecord.builder()
                .statusFrom(currentStatus)
                .statusTo(targetStatus)
                .action(action)
                .operatorId(req.getOperatorId())
                .operatorName(operatorName)
                .opinion(opinion)
                .timestamp(Instant.now())
                .build();

        if (notarizationCase.getWorkflowHistory() == null) {
            notarizationCase.setWorkflowHistory(new ArrayList<>());
        }
        notarizationCase.getWorkflowHistory().add(record);

        if (action == WorkflowAction.APPROVE) {
            if (notarizationCase.getApprovalRecords() == null) {
                notarizationCase.setApprovalRecords(new ArrayList<>());
            }
            notarizationCase.getApprovalRecords().add(NotarizationCase.ApprovalRecord.builder()
                    .reviewerId(req.getOperatorId())
                    .reviewerName(operatorName)
                    .opinion(opinion)
                    .approved(true)
                    .timestamp(Instant.now())
                    .build());
        }

        if (action == WorkflowAction.REJECT) {
            if (notarizationCase.getApprovalRecords() == null) {
                notarizationCase.setApprovalRecords(new ArrayList<>());
            }
            notarizationCase.getApprovalRecords().add(NotarizationCase.ApprovalRecord.builder()
                    .reviewerId(req.getOperatorId())
                    .reviewerName(operatorName)
                    .opinion(opinion)
                    .approved(false)
                    .timestamp(Instant.now())
                    .build());
        }

        notarizationCase.setStatus(targetStatus);
        return notarizationRepository.save(notarizationCase);
    }

    @Override
    public CaseStatus getCaseStatus(String caseId) {
        NotarizationCase notarizationCase = notarizationRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CASE_NOT_FOUND));
        return notarizationCase.getStatus();
    }

    @Override
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void autoReassignUnclaimed() {
        log.info("Starting autoReassignUnclaimed task...");
        Instant threshold = Instant.now().minusSeconds(86400);
        List<NotarizationCase> unclaimedCases = notarizationRepository
                .findByStatusAndAssignedNotaryIdNullAndCreatedAtBefore(CaseStatus.ACCEPTED, threshold);

        log.info("Found {} unclaimed cases to reassign", unclaimedCases.size());

        for (NotarizationCase notarizationCase : unclaimedCases) {
            List<User> availableNotaries = userRepository.findByRoleAndAvailableAndHallId(
                    UserRole.NOTARY, true, notarizationCase.getHallId());
            if (!availableNotaries.isEmpty()) {
                User assignedNotary = availableNotaries.get(0);
                notarizationCase.setAssignedNotaryId(assignedNotary.getId());

                if (notarizationCase.getWorkflowHistory() == null) {
                    notarizationCase.setWorkflowHistory(new ArrayList<>());
                }
                notarizationCase.getWorkflowHistory().add(NotarizationCase.WorkflowRecord.builder()
                        .statusFrom(CaseStatus.ACCEPTED)
                        .statusTo(CaseStatus.ACCEPTED)
                        .action(null)
                        .operatorId("SYSTEM")
                        .operatorName("System Auto Reassign")
                        .opinion("超时未认领，系统自动转派公证员：" + assignedNotary.getRealName())
                        .timestamp(Instant.now())
                        .build());

                notarizationRepository.save(notarizationCase);
                log.info("Reassigned case {} to notary {}",
                        notarizationCase.getCaseNumber(), assignedNotary.getId());
            } else {
                log.warn("No available notaries found for hall {} when reassigning case {}",
                        notarizationCase.getHallId(), notarizationCase.getCaseNumber());
            }
        }
        log.info("autoReassignUnclaimed task completed");
    }

    private synchronized String generateCaseNumber() {
        String datePrefix = "GZ" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        if (!datePrefix.equals(lastDatePrefix)) {
            lastDatePrefix = datePrefix;
            dailyCounter.set(0);
        }
        int sequence = dailyCounter.incrementAndGet();
        List<NotarizationCase> latestCases = notarizationRepository
                .findTopByCaseNumberStartingWithOrderByCaseNumberDesc(datePrefix);
        if (!latestCases.isEmpty()) {
            String latestNumber = latestCases.get(0).getCaseNumber();
            String seqStr = latestNumber.substring(datePrefix.length());
            try {
                int existingSeq = Integer.parseInt(seqStr);
                if (existingSeq >= sequence) {
                    sequence = existingSeq + 1;
                    dailyCounter.set(sequence);
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return datePrefix + String.format("%06d", sequence);
    }
}
