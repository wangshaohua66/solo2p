package com.notarization.service.impl;

import com.notarization.dto.request.CrossHallAccessRequest;
import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.AccessRequest;
import com.notarization.model.NotarizationCase;
import com.notarization.model.User;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import com.notarization.repository.AccessRequestRepository;
import com.notarization.repository.NotarizationRepository;
import com.notarization.repository.UserRepository;
import com.notarization.service.AccessControlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccessControlServiceImpl implements AccessControlService {

    private final AccessRequestRepository accessRequestRepository;
    private final NotarizationRepository notarizationRepository;
    private final UserRepository userRepository;

    @Override
    public AccessRequest requestCrossHallAccess(CrossHallAccessRequest req) {
        AccessRequest.AuditEntry auditEntry = AccessRequest.AuditEntry.builder()
                .userId(req.getApplicantId())
                .action("申请创建")
                .timestamp(Instant.now())
                .ip(null)
                .build();

        List<AccessRequest.AuditEntry> auditLog = new ArrayList<>();
        auditLog.add(auditEntry);

        AccessRequest request = AccessRequest.builder()
                .id(generateUUID())
                .caseId(req.getCaseId())
                .fromHallId(HallId.valueOf(req.getFromHallId()))
                .toHallId(HallId.valueOf(req.getToHallId()))
                .applicantId(req.getApplicantId())
                .reason(req.getReason())
                .status(AccessRequest.Status.Pending)
                .requestTime(Instant.now())
                .approveTime(null)
                .approverId(null)
                .auditLog(auditLog)
                .build();

        return accessRequestRepository.save(request);
    }

    @Override
    public AccessRequest approveAccess(String requestId, String approverId, boolean approved) {
        AccessRequest request = accessRequestRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAM_INVALID, "访问申请不存在"));

        AccessRequest.AuditEntry auditEntry = AccessRequest.AuditEntry.builder()
                .userId(approverId)
                .action(approved ? "申请通过" : "申请驳回")
                .timestamp(Instant.now())
                .ip(null)
                .build();

        request.setStatus(approved ? AccessRequest.Status.Approved : AccessRequest.Status.Rejected);
        request.setApproverId(approverId);
        request.setApproveTime(Instant.now());
        request.getAuditLog().add(auditEntry);

        return accessRequestRepository.save(request);
    }

    @Override
    public NotarizationCase accessCaseWithAudit(String caseId, String userId, String ip) {
        NotarizationCase notarizationCase = notarizationRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CASE_NOT_FOUND));

        if (NotarizationType.WILL.equals(notarizationCase.getCaseType())) {
            checkWillAccess(caseId, userId);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));

        if (!notarizationCase.getHallId().equals(user.getHallId())) {
            boolean hasApprovedAccess = accessRequestRepository
                    .findByCaseIdAndStatus(caseId, AccessRequest.Status.Approved.name())
                    .isPresent();

            if (!hasApprovedAccess) {
                throw new BusinessException(ErrorCode.ACCESS_DENIED, "无跨大厅访问权限");
            }
        }

        AccessRequest.AuditEntry auditEntry = AccessRequest.AuditEntry.builder()
                .userId(userId)
                .action("卷宗调阅")
                .timestamp(Instant.now())
                .ip(ip)
                .build();

        log.info("卷宗调阅审计: caseId={}, userId={}, ip={}, time={}", caseId, userId, ip, Instant.now());

        return notarizationCase;
    }

    @Override
    public void checkWillAccess(String caseId, String userId) {
        NotarizationCase notarizationCase = notarizationRepository.findById(caseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CASE_NOT_FOUND));

        NotarizationCase.AccessControl accessControl = notarizationCase.getAccessControl();

        if (accessControl == null || !Boolean.TRUE.equals(accessControl.getIsRestricted())) {
            return;
        }

        List<String> allowedUserIds = accessControl.getAllowedUserIds();
        if (allowedUserIds == null || !allowedUserIds.contains(userId)) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }
    }

    @Override
    public Page<AccessRequest> getPendingRequests(String hallId, Pageable pageable) {
        return accessRequestRepository.findByToHallIdAndStatus(hallId, AccessRequest.Status.Pending.name(), pageable);
    }

    @Override
    public Page<AccessRequest> getMyRequests(String userId, Pageable pageable) {
        return accessRequestRepository.findByApplicantId(userId, pageable);
    }

    private String generateUUID() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
