package com.emergency.auth.service;

import com.emergency.auth.entity.Approval;
import com.emergency.common.dto.PageQuery;
import com.emergency.common.dto.PageResult;
import com.emergency.common.enums.ApprovalStatus;

import java.util.List;

public interface ApprovalService {

    Approval createApproval(String businessType, Long businessId, String businessNo,
                            Integer requiredLevel, String remark);

    Approval processApproval(Long approvalId, ApprovalStatus status, String opinion);

    Approval getApprovalById(Long id);

    Approval getLatestApproval(String businessType, Long businessId);

    List<Approval> getPendingApprovals(Long approverId);

    PageResult<Approval> getApprovalList(PageQuery query);

    boolean requiresApproval(Integer incidentLevel, Integer userLevel);

    Long getNextApproverId(Long applicantOrgId, Integer requiredLevel);
}
