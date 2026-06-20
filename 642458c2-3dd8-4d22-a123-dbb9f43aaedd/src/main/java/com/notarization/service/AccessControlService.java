package com.notarization.service;

import com.notarization.dto.request.CrossHallAccessRequest;
import com.notarization.model.AccessRequest;
import com.notarization.model.NotarizationCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AccessControlService {

    AccessRequest requestCrossHallAccess(CrossHallAccessRequest req);

    AccessRequest approveAccess(String requestId, String approverId, boolean approved);

    NotarizationCase accessCaseWithAudit(String caseId, String userId, String ip);

    void checkWillAccess(String caseId, String userId);

    Page<AccessRequest> getPendingRequests(String hallId, Pageable pageable);

    Page<AccessRequest> getMyRequests(String userId, Pageable pageable);
}
