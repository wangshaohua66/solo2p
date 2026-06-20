package com.design.collaboration.service;

import com.design.collaboration.dto.ApprovalRequest;
import com.design.collaboration.dto.ChangeCreateRequest;
import com.design.collaboration.entity.ChangeApproval;
import com.design.collaboration.entity.ChangeRequest;
import com.design.collaboration.entity.User;
import com.design.collaboration.enums.ChangeStatus;
import com.design.collaboration.mapper.ChangeMapper;
import com.design.collaboration.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ChangeService {

    @Autowired
    private ChangeMapper changeMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ProjectService projectService;

    public ChangeRequest findById(Long id) {
        ChangeRequest change = changeMapper.findById(id);
        if (change != null) {
            change.setApprovalRecords(changeMapper.findApprovalsByChangeRequestId(id));
        }
        return change;
    }

    public List<ChangeRequest> findByConditions(Long projectId, ChangeStatus status, Long applicantId) {
        return changeMapper.findByConditions(projectId, status, applicantId);
    }

    public ChangeRequest create(ChangeCreateRequest request, Long applicantId) {
        ChangeRequest change = new ChangeRequest();
        change.setProjectId(request.getProjectId());
        change.setTitle(request.getTitle());
        change.setReason(request.getReason());
        change.setContent(request.getContent());
        change.setImpactScope(request.getImpactScope());
        change.setWorkload(request.getWorkload() != null ? request.getWorkload() : 0);
        change.setAdditionalFee(request.getAdditionalFee() != null ? request.getAdditionalFee() : BigDecimal.ZERO);
        change.setStatus(ChangeStatus.DRAFT);
        change.setApplicantId(applicantId);
        change.setApplicantType(request.getApplicantType() != null ? request.getApplicantType() : "INTERNAL");
        change.setCreatedAt(LocalDateTime.now());

        String year = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy"));
        long count = changeMapper.findByConditions(null, null, null).size();
        change.setChangeNo(String.format("CHG-%s-%03d", year, count + 1));

        changeMapper.insert(change);

        User applicant = applicantId != null ? userMapper.findById(applicantId) : null;
        projectService.addLog(request.getProjectId(), "CHANGE",
                "发起设计变更：" + change.getTitle(),
                applicantId, applicant != null ? applicant.getName() : null);

        return findById(change.getId());
    }

    public ChangeRequest submit(Long id, Long operatorId) {
        ChangeRequest change = changeMapper.findById(id);
        if (change == null) {
            throw new RuntimeException("变更申请不存在");
        }
        if (change.getStatus() != ChangeStatus.DRAFT) {
            throw new RuntimeException("只有草稿状态可以提交");
        }

        User operator = operatorId != null ? userMapper.findById(operatorId) : null;
        Long pmId = null;
        List<User> pms = userMapper.findByRole(com.design.collaboration.enums.UserRole.PROJECT_MANAGER);
        if (!pms.isEmpty()) pmId = pms.get(0).getId();

        changeMapper.updateStatus(id, ChangeStatus.SUBMITTED, pmId);

        projectService.addLog(change.getProjectId(), "CHANGE",
                "提交变更申请审批：" + change.getTitle(),
                operatorId, operator != null ? operator.getName() : null);

        return findById(id);
    }

    public ChangeRequest approve(Long id, ApprovalRequest request, Long approverId) {
        ChangeRequest change = changeMapper.findById(id);
        if (change == null) {
            throw new RuntimeException("变更申请不存在");
        }

        User approver = approverId != null ? userMapper.findById(approverId) : null;
        String approverRole = approver != null ? approver.getRole().name() : "";

        ChangeApproval approval = new ChangeApproval();
        approval.setChangeRequestId(id);
        approval.setApproverId(approverId);
        approval.setApproverRole(approverRole);
        approval.setComment(request.getComment());
        approval.setApproved(request.getApproved());
        approval.setApprovedAt(LocalDateTime.now());
        changeMapper.insertApproval(approval);

        if (!request.getApproved()) {
            changeMapper.updateStatus(id, ChangeStatus.REJECTED, null);
            projectService.addLog(change.getProjectId(), "CHANGE",
                    "变更申请被驳回：" + change.getTitle() + "，原因：" + request.getComment(),
                    approverId, approver != null ? approver.getName() : null);
            return findById(id);
        }

        ChangeStatus nextStatus;
        Long nextApproverId = null;
        List<User> leads = userMapper.findByRole(com.design.collaboration.enums.UserRole.PROFESSIONAL_LEAD);
        List<User> pms = userMapper.findByRole(com.design.collaboration.enums.UserRole.PROJECT_MANAGER);
        List<User> clients = userMapper.findByRole(com.design.collaboration.enums.UserRole.CLIENT);

        switch (change.getStatus()) {
            case SUBMITTED:
                nextStatus = ChangeStatus.PM_APPROVED;
                if (!leads.isEmpty()) nextApproverId = leads.get(0).getId();
                break;
            case PM_APPROVED:
                nextStatus = ChangeStatus.LEAD_APPROVED;
                if (!clients.isEmpty()) nextApproverId = clients.get(0).getId();
                break;
            case LEAD_APPROVED:
                nextStatus = ChangeStatus.CLIENT_APPROVED;
                break;
            default:
                nextStatus = ChangeStatus.CLIENT_APPROVED;
        }

        changeMapper.updateStatus(id, nextStatus, nextApproverId);

        projectService.addLog(change.getProjectId(), "CHANGE",
                "变更申请" + approverRole + "审批通过：" + change.getTitle(),
                approverId, approver != null ? approver.getName() : null);

        return findById(id);
    }
}
