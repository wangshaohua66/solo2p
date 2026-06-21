package com.court.execution.service;

import com.court.execution.entity.ApprovalTask;
import com.court.execution.entity.ApprovalType;
import com.court.execution.entity.User;
import com.court.execution.entity.UserRole;
import com.court.execution.repository.ApprovalTaskRepository;
import com.court.execution.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ApprovalService {

    private static final Logger logger = LoggerFactory.getLogger(ApprovalService.class);

    private final ApprovalTaskRepository approvalRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public ApprovalService(ApprovalTaskRepository approvalRepository,
                           UserRepository userRepository,
                           NotificationService notificationService) {
        this.approvalRepository = approvalRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public ApprovalTask createApprovalTask(ApprovalType type, Long relatedId,
                                            String relatedTitle, Long applicantId) {
        User applicant = userRepository.findById(applicantId)
                .orElseThrow(() -> new RuntimeException("申请人不存在"));

        User approver = findApprover(applicant);
        if (approver == null) {
            throw new RuntimeException("找不到审批人");
        }

        ApprovalTask task = new ApprovalTask();
        task.setType(type);
        task.setRelatedId(relatedId);
        task.setRelatedTitle(relatedTitle);
        task.setApplicant(applicant);
        task.setApprover(approver);
        task.setStatus("PENDING");

        ApprovalTask saved = approvalRepository.save(task);

        String taskTypeName = getApprovalTypeDescription(type);
        notificationService.sendApprovalTask(approver, saved.getId(), taskTypeName, relatedTitle, applicant);

        logger.info("审批任务已创建: 类型={}, 关联ID={}, 申请人={}, 审批人={}",
                type, relatedId, applicant.getUsername(), approver.getUsername());

        return saved;
    }

    private User findApprover(User applicant) {
        if (applicant.getRole() == UserRole.JUDGE) {
            return userRepository.findByRole(UserRole.ADMIN).stream().findFirst().orElse(null);
        }
        return userRepository.findByRole(UserRole.JUDGE).stream().findFirst().orElse(
                userRepository.findByRole(UserRole.ADMIN).stream().findFirst().orElse(null));
    }

    private String getApprovalTypeDescription(ApprovalType type) {
        return switch (type) {
            case SEIZURE_CREATE -> "查封冻结申请";
            case SEIZURE_EXTEND -> "续封申请";
            case SEIZURE_RELEASE -> "解封申请";
            case DISTRIBUTION_PLAN -> "分配方案审批";
            case AUCTION_PUBLISH -> "拍卖发布审批";
        };
    }

    public ApprovalTask getTaskById(Long taskId) {
        return approvalRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("审批任务不存在"));
    }

    public List<ApprovalTask> getTasksByApprover(Long approverId) {
        return approvalRepository.findByApproverIdOrderByCreateTimeDesc(approverId);
    }

    public List<ApprovalTask> getPendingTasksByApproverUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return approvalRepository.findByApproverIdAndStatusOrderByCreateTimeDesc(user.getId(), "PENDING");
    }

    public List<ApprovalTask> getTasksByApplicantUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return approvalRepository.findByApplicantIdOrderByCreateTimeDesc(user.getId());
    }

    @Transactional
    public ApprovalTask approveTaskByUsername(Long taskId, String approverUsername,
                                               boolean approved, String comment) {
        User approver = userRepository.findByUsername(approverUsername)
                .orElseThrow(() -> new RuntimeException("审批人不存在"));
        return approveTask(taskId, approver.getId(), approved, comment);
    }

    public Page<ApprovalTask> getPendingTasksByApprover(Long approverId, Pageable pageable) {
        return approvalRepository.findByApproverIdAndStatus(approverId, "PENDING", pageable);
    }

    public List<ApprovalTask> getTasksByApplicant(Long applicantId) {
        return approvalRepository.findByApplicantIdOrderByCreateTimeDesc(applicantId);
    }

    public List<ApprovalTask> getTasksByTypeAndRelatedId(ApprovalType type, Long relatedId) {
        return approvalRepository.findByTypeAndRelatedId(type, relatedId);
    }

    public long getPendingCountByApprover(Long approverId) {
        return approvalRepository.countByApproverIdAndStatus(approverId, "PENDING");
    }

    @Transactional
    public ApprovalTask approveTask(Long taskId, Long approverId, boolean approved, String comment) {
        ApprovalTask task = approvalRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("审批任务不存在"));

        if (!task.getApprover().getId().equals(approverId)) {
            throw new RuntimeException("您不是该任务的审批人");
        }

        if (!"PENDING".equals(task.getStatus())) {
            throw new RuntimeException("该任务已被处理");
        }

        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new RuntimeException("审批人不存在"));

        task.setStatus(approved ? "APPROVED" : "REJECTED");
        task.setApprovalComment(comment);
        task.setApprovalTime(LocalDateTime.now());

        ApprovalTask saved = approvalRepository.save(task);

        String taskTypeName = getApprovalTypeDescription(task.getType());
        notificationService.sendApprovalResult(task.getApplicant(), taskTypeName,
                task.getRelatedTitle(), approved, comment);

        logger.info("审批任务已处理: 任务ID={}, 结果={}, 审批人={}",
                taskId, approved ? "通过" : "驳回", approver.getUsername());

        return saved;
    }

    public boolean isApproved(ApprovalType type, Long relatedId) {
        List<ApprovalTask> tasks = approvalRepository.findByTypeAndRelatedId(type, relatedId);
        return tasks.stream().anyMatch(t -> "APPROVED".equals(t.getStatus()));
    }

    public ApprovalTask getLatestTask(ApprovalType type, Long relatedId) {
        List<ApprovalTask> tasks = approvalRepository.findByTypeAndRelatedId(type, relatedId);
        return tasks.isEmpty() ? null : tasks.get(0);
    }
}
