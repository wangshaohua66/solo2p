package com.court.execution.repository;

import com.court.execution.entity.ApprovalTask;
import com.court.execution.entity.ApprovalType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApprovalTaskRepository extends JpaRepository<ApprovalTask, Long> {

    List<ApprovalTask> findByApproverIdOrderByCreateTimeDesc(Long approverId);

    List<ApprovalTask> findByApproverIdAndStatusOrderByCreateTimeDesc(Long approverId, String status);

    List<ApprovalTask> findByApplicantIdOrderByCreateTimeDesc(Long applicantId);

    List<ApprovalTask> findByTypeAndRelatedId(ApprovalType type, Long relatedId);

    Page<ApprovalTask> findByApproverIdAndStatus(Long approverId, String status, Pageable pageable);

    long countByApproverIdAndStatus(Long approverId, String status);
}
