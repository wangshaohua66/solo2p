package com.emergency.auth.service.impl;

import com.emergency.auth.entity.Approval;
import com.emergency.auth.entity.ApprovalLog;
import com.emergency.auth.entity.Organization;
import com.emergency.auth.entity.User;
import com.emergency.auth.mapper.ApprovalLogMapper;
import com.emergency.auth.mapper.ApprovalMapper;
import com.emergency.auth.mapper.OrganizationMapper;
import com.emergency.auth.mapper.UserMapper;
import com.emergency.auth.service.ApprovalService;
import com.emergency.auth.service.OrganizationService;
import com.emergency.common.dto.LoginUser;
import com.emergency.common.dto.PageQuery;
import com.emergency.common.dto.PageResult;
import com.emergency.common.enums.ApprovalStatus;
import com.emergency.common.enums.OrganizationLevel;
import com.emergency.common.exception.BusinessException;
import com.emergency.common.result.ResultCode;
import com.emergency.common.util.SecurityUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalServiceImpl implements ApprovalService {

    private final ApprovalMapper approvalMapper;
    private final ApprovalLogMapper approvalLogMapper;
    private final OrganizationMapper organizationMapper;
    private final UserMapper userMapper;
    private final OrganizationService organizationService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Approval createApproval(String businessType, Long businessId, String businessNo,
                                   Integer requiredLevel, String remark) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        Long currentOrgId = currentUser.getOrganizationId();
        Integer currentLevel = currentUser.getOrganizationLevel();

        if (currentLevel <= requiredLevel) {
            Approval approval = new Approval();
            approval.setBusinessType(businessType);
            approval.setBusinessId(businessId);
            approval.setBusinessNo(businessNo);
            approval.setApplicantId(currentUser.getUserId());
            approval.setApplicantName(currentUser.getRealName());
            approval.setApplicantOrgId(currentOrgId);
            approval.setApprovalLevel(requiredLevel);
            approval.setStatus(ApprovalStatus.APPROVED);
            approval.setRemark("自动审批：本级权限足够");
            approval.setApprovedAt(LocalDateTime.now());
            approval.setApprovalOpinion("系统自动审批通过");
            approvalMapper.insert(approval);

            recordApprovalLog(approval, currentUser.getUserId(), currentUser.getRealName(),
                    currentOrgId, requiredLevel, ApprovalStatus.APPROVED, "系统自动审批通过");
            return approval;
        }

        Long nextApproverId = getNextApproverId(currentOrgId, requiredLevel);
        if (nextApproverId == null) {
            throw new BusinessException(ResultCode.APPROVAL_REQUIRED, "未找到上级审批人");
        }

        User approver = userMapper.selectById(nextApproverId);
        Organization approverOrg = organizationMapper.selectById(approver.getOrganizationId());

        Approval approval = new Approval();
        approval.setBusinessType(businessType);
        approval.setBusinessId(businessId);
        approval.setBusinessNo(businessNo);
        approval.setApplicantId(currentUser.getUserId());
        approval.setApplicantName(currentUser.getRealName());
        approval.setApplicantOrgId(currentOrgId);
        approval.setCurrentApproverId(nextApproverId);
        approval.setCurrentApproverName(approver.getRealName());
        approval.setApproverOrgId(approverOrg.getId());
        approval.setApprovalLevel(requiredLevel);
        approval.setStatus(ApprovalStatus.PENDING);
        approval.setRemark(remark);
        approvalMapper.insert(approval);

        log.info("创建审批流程: approvalId={}, businessType={}, businessId={}, approverId={}",
                approval.getId(), businessType, businessId, nextApproverId);

        return approval;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Approval processApproval(Long approvalId, ApprovalStatus status, String opinion) {
        LoginUser currentUser = SecurityUtils.getCurrentUser();
        if (currentUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        Approval approval = approvalMapper.selectById(approvalId);
        if (approval == null) {
            throw new BusinessException(ResultCode.APPROVAL_NOT_FOUND);
        }

        if (approval.getStatus() != ApprovalStatus.PENDING) {
            throw new BusinessException("该审批已处理，无法重复操作");
        }

        if (!approval.getCurrentApproverId().equals(currentUser.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "您不是当前审批人");
        }

        approvalMapper.updateApprovalStatus(approvalId, status, opinion, LocalDateTime.now(), currentUser.getUserId());

        recordApprovalLog(approval, currentUser.getUserId(), currentUser.getRealName(),
                currentUser.getOrganizationId(), approval.getApprovalLevel(), status, opinion);

        log.info("审批处理完成: approvalId={}, status={}, approverId={}", approvalId, status, currentUser.getUserId());

        approval.setStatus(status);
        return approval;
    }

    private void recordApprovalLog(Approval approval, Long approverId, String approverName,
                                   Long approverOrgId, Integer level, ApprovalStatus action, String opinion) {
        ApprovalLog logEntry = new ApprovalLog();
        logEntry.setApprovalId(approval.getId());
        logEntry.setApproverId(approverId);
        logEntry.setApproverName(approverName);
        logEntry.setApproverOrgId(approverOrgId);
        logEntry.setApprovalLevel(level);
        logEntry.setAction(action);
        logEntry.setOpinion(opinion);
        logEntry.setActionTime(LocalDateTime.now());
        approvalLogMapper.insert(logEntry);
    }

    @Override
    public Approval getApprovalById(Long id) {
        return approvalMapper.selectById(id);
    }

    @Override
    public Approval getLatestApproval(String businessType, Long businessId) {
        return approvalMapper.selectLatestByBusiness(businessType, businessId);
    }

    @Override
    public List<Approval> getPendingApprovals(Long approverId) {
        return approvalMapper.selectPendingByApproverId(approverId, ApprovalStatus.PENDING);
    }

    @Override
    public PageResult<Approval> getApprovalList(PageQuery query) {
        LambdaQueryWrapper<Approval> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(Approval::getCreatedAt);

        Page<Approval> page = new Page<>(query.getPageNum(), query.getPageSize());
        approvalMapper.selectPage(page, wrapper);

        return PageResult.of(page);
    }

    @Override
    public boolean requiresApproval(Integer incidentLevel, Integer userLevel) {
        return userLevel > incidentLevel;
    }

    @Override
    public Long getNextApproverId(Long applicantOrgId, Integer requiredLevel) {
        Organization org = organizationMapper.selectById(applicantOrgId);
        if (org == null) {
            return null;
        }

        while (org != null && org.getLevel().getCode() > requiredLevel) {
            if (org.getParentId() != null) {
                org = organizationMapper.selectById(org.getParentId());
            } else {
                break;
            }
        }

        if (org == null) {
            return null;
        }

        List<Long> userIds = userMapper.selectUserIdsByOrgId(org.getId());
        if (userIds == null || userIds.isEmpty()) {
            return null;
        }

        for (Long userId : userIds) {
            User user = userMapper.selectById(userId);
            if (user != null && user.isEnabled()) {
                List<String> roles = userMapper.selectRoleCodesByUserId(userId);
                if (roles.contains("ADMIN") || roles.contains("PROVINCE_ADMIN")
                        || roles.contains("CITY_ADMIN") || roles.contains("DISPATCHER")) {
                    return userId;
                }
            }
        }

        return userIds.get(0);
    }
}
