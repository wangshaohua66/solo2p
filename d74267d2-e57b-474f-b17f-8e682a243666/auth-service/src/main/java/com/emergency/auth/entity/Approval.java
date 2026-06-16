package com.emergency.auth.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.ApprovalStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_approval")
public class Approval extends BaseEntity {

    private String businessType;

    private Long businessId;

    private String businessNo;

    private Long applicantId;

    private String applicantName;

    private Long applicantOrgId;

    private Long currentApproverId;

    private String currentApproverName;

    private Long approverOrgId;

    private Integer approvalLevel;

    private ApprovalStatus status;

    private String remark;

    private LocalDateTime approvedAt;

    private String approvalOpinion;
}
